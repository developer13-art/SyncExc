/**
 * SyncExc Server — Terminal service
 *
 * Read-side + management operations for orders, positions, trades.
 * Submission is handled by order-submission.service.js.
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';
import { ORDER_STATUS } from '@syncexc/shared';

const OPEN_ORDER_STATUSES = [
  ORDER_STATUS.PENDING_SUBMISSION,
  ORDER_STATUS.SUBMITTED,
  ORDER_STATUS.ACKNOWLEDGED,
  ORDER_STATUS.PARTIALLY_FILLED,
  ORDER_STATUS.CANCEL_REQUESTED,
  ORDER_STATUS.UNKNOWN,
  ORDER_STATUS.RECONCILIATION_REQUIRED,
];

export function createTerminalService({
  db,
  queries,
  marketData,
  connections,
  executionService,
  events,
  audit,
  logger,
}) {
  async function getMarketData(params) {
    return marketData.getMarketData(params);
  }

  async function getOrder(orderId, workspaceId) {
    const order = await queries.findOrderById(orderId);
    if (!order || (workspaceId && order.workspace_id !== workspaceId)) {
      throw new NotFoundError('Order');
    }
    const events = await queries.listOrderEvents(orderId);
    const fills = await queries.listFillsForOrder(orderId);
    return { order, events, fills };
  }

  async function listOrdersForScope({ workspaceId, statuses, accountId, limit, cursor }) {
    if (statuses?.length === 1 && statuses[0] === 'open') {
      statuses = OPEN_ORDER_STATUSES;
    }
    return queries.listOrders(workspaceId, { statuses, accountId, limit, cursor });
  }

  async function listOpenOrders({ workspaceId, accountId }) {
    return queries.listOrders(workspaceId, {
      statuses: OPEN_ORDER_STATUSES,
      accountId,
      limit: 200,
    });
  }

  async function listTradesForScope({ workspaceId, limit, cursor, accountId, instrument }) {
    return queries.listTradesForScope(workspaceId, { limit, cursor, accountId, instrument });
  }

  async function listPositions({ workspaceId, accountId, instrument }) {
    return queries.listPositions(workspaceId, { accountId, instrument });
  }

  async function syncAccountState({ workspaceId, accountId }) {
    const account = await connections.requireAccountAccess({
      accountId,
      workspaceId,
      operation: 'view_balances',
    });
    if (account.status !== 'active') {
      throw new ConflictError('The selected account is not active', 'ACCOUNT_NOT_ACTIVE');
    }

    const connection = await connections.getConnection(account.connection_id);
    if (!connection || connection.status !== 'active') {
      throw new ConflictError('The selected connection is not active', 'CONNECTION_NOT_ACTIVE');
    }
    const adapter = await connections.getAdapter(connection.exchange_code);
    const credentials = await connections.loadCredentials(connection.id);
    const adapterContext = {
      ...credentials,
      accountType: account.account_type,
      environment: connection.environment,
    };
    if (typeof adapter.fetchPositions !== 'function') {
      throw new Error(`The ${connection.exchange_code} adapter does not support position syncing`);
    }
    const positions = await adapter.fetchPositions(adapterContext);
    if (!Array.isArray(positions)) {
      throw new Error(`The ${connection.exchange_code} adapter returned invalid position data`);
    }

    await db.tx(async (tx) => {
      for (const position of positions) {
        const stored = await queries.upsertPosition(tx, {
          workspaceId,
          connectionId: connection.id,
          accountId,
          instrument: position.instrument,
          side: position.side,
          quantity: position.quantity,
          entryPrice: position.entryPrice,
          markPrice: position.markPrice,
          unrealizedPnl: position.unrealizedPnl,
          leverage: position.leverage,
          liquidationPrice: position.liquidationPrice,
          marginMode: position.marginMode,
          positionMode: position.positionMode,
        });
        await queries.insertPositionSnapshot(tx, {
          positionId: stored.id,
          quantity: position.quantity,
          entryPrice: position.entryPrice,
          markPrice: position.markPrice,
          unrealizedPnl: position.unrealizedPnl,
        });
      }
      await queries.clearMissingPositions(tx, accountId, positions);
    });

    const activeOrders = await queries.listOrders(workspaceId, {
      accountId,
      statuses: OPEN_ORDER_STATUSES,
      limit: 200,
    });
    for (const order of activeOrders.rows) {
      if (!order.exchange_order_id || typeof adapter.fetchOrder !== 'function') continue;
      const exchangeOrder = await adapter.fetchOrder({
        ...adapterContext,
        instrument: order.instrument,
        exchangeOrderId: order.exchange_order_id,
        marketType: order.market_type,
      });
      if (!exchangeOrder) continue;
      await executionService.handleExecutionUpdate({
        connectionId: connection.id,
        update: exchangeOrder,
      });
    }

    return queries.listPositions(workspaceId, { accountId });
  }

  async function getExecutionRequest(executionRequestId, workspaceId) {
    const request = await queries.findExecutionRequestById(executionRequestId);
    if (!request || (workspaceId && request.workspace_id !== workspaceId)) {
      throw new NotFoundError('Execution request');
    }
    const attempts = await queries.listExecutionAttempts(executionRequestId);
    return { request, attempts };
  }

  /* ===========================================================================
   * PREFERENCES
   * ======================================================================== */

  async function getPreferences({ userId }) {
    return queries.getPreferences(userId);
  }

  async function updatePreferences({ userId, updates }) {
    return queries.upsertPreferences(userId, updates);
  }

  /* ===========================================================================
   * SAVED VIEWS
   * ======================================================================== */

  async function listSavedViews({ userId, workspaceId }) {
    return queries.listSavedViews(userId, workspaceId);
  }

  async function createSavedView({ userId, workspaceId, name, viewType, config }) {
    return queries.insertSavedView({ userId, workspaceId, name, viewType, config });
  }

  async function deleteSavedView({ userId, viewId }) {
    const ok = await queries.deleteSavedView(viewId, userId);
    if (!ok) throw new NotFoundError('Saved view');
    return { ok: true };
  }

  return {
    getMarketData,
    getOrder,
    listOrdersForScope,
    listOpenOrders,
    listTradesForScope,
    listPositions,
    syncAccountState,
    getExecutionRequest,
    getPreferences,
    updatePreferences,
    listSavedViews,
    createSavedView,
    deleteSavedView,
  };
}

export default createTerminalService;