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

export function createTerminalService({ db, queries, marketData, events, audit, logger }) {
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
    getExecutionRequest,
    getPreferences,
    updatePreferences,
    listSavedViews,
    createSavedView,
    deleteSavedView,
  };
}

export default createTerminalService;