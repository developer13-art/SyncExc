/**
 * SyncExc Server — Terminal service
 *
 * Read-side + management operations for orders, positions, trades.
 * Submission is handled by order-submission.service.js.
 */

import {
  AppError,
  ConflictError,
  ExternalProviderError,
  NotFoundError,
} from '../../lib/errors.js';
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
  async function fetchFromExchange({ exchangeCode, accountId, stage, fetch }) {
    try {
      return await fetch();
    } catch (error) {
      logger?.error?.(
        {
          exchangeCode,
          accountId,
          stage,
          providerCode: error.exchangeResponse?.retCode ?? error.statusCode ?? null,
          errorName: error.name || 'Error',
        },
        'Exchange account sync step failed',
      );
      if (error instanceof AppError) throw error;

      const providerMessage = error.exchangeResponse?.retMsg;
      throw new ExternalProviderError(
        providerMessage
          ? `${exchangeCode} ${stage} failed: ${providerMessage}`
          : `${exchangeCode} ${stage} failed. Check the exchange connection and API permissions.`,
        {
          provider: exchangeCode,
          retryable: Boolean(error.retryable),
          status: 502,
          details: {
            stage,
            providerCode: error.exchangeResponse?.retCode ?? error.statusCode ?? undefined,
          },
        },
      );
    }
  }

  async function withClosedPnlStorage(work) {
    try {
      return await work();
    } catch (error) {
      if (error.code !== '42P01' && error.code !== '42703') throw error;
      throw new AppError(
        'Closed-trade sync storage is not available. Run the pending database migrations and restart the server.',
        {
          code: 'TERMINAL_SYNC_SCHEMA_MISSING',
          status: 503,
          expose: true,
          details: { migration: '033_terminal_closed_trade_history.sql' },
          cause: error,
        },
      );
    }
  }

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
    const positions = await fetchFromExchange({
      exchangeCode: connection.exchange_code,
      accountId,
      stage: 'position sync',
      fetch: () => adapter.fetchPositions(adapterContext),
    });
    if (!Array.isArray(positions)) {
      throw new Error(`The ${connection.exchange_code} adapter returned invalid position data`);
    }

    let balanceState = null;
    if (typeof adapter.fetchAccountState === 'function') {
      balanceState = await fetchFromExchange({
        exchangeCode: connection.exchange_code,
        accountId,
        stage: 'account balance sync',
        fetch: () => adapter.fetchAccountState(adapterContext),
      });
    } else if (typeof adapter.fetchBalances === 'function') {
      balanceState = {
        balances: await fetchFromExchange({
          exchangeCode: connection.exchange_code,
          accountId,
          stage: 'account balance sync',
          fetch: () => adapter.fetchBalances(adapterContext),
        }),
      };
    }
    if (balanceState && !Array.isArray(balanceState.balances)) {
      throw new Error(`${connection.exchange_code} adapter returned invalid balance data`);
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

      if (balanceState) {
        const observedAt = new Date();
        const snapshot = await tx.query(
          `
          INSERT INTO exchange_balance_snapshots (account_id, observed_at)
          VALUES ($1, $2)
          RETURNING id
          `,
          [accountId, observedAt],
        );
        for (const balance of balanceState.balances) {
          await tx.query(
            `
            INSERT INTO exchange_balance_items (snapshot_id, asset, free, used, total)
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
              snapshot.rows[0].id,
              balance.asset,
              balance.free ?? 0,
              balance.used ?? 0,
              balance.total ?? 0,
            ],
          );
        }
        if (
          balanceState.equity !== null &&
          balanceState.equity !== undefined &&
          balanceState.equity !== '' &&
          Number.isFinite(Number(balanceState.equity))
        ) {
          await tx.query(
            `
            INSERT INTO exchange_account_snapshots (account_id, equity, available_margin, observed_at)
            VALUES ($1, $2, $3, $4)
            `,
            [accountId, balanceState.equity, balanceState.availableEquity ?? null, observedAt],
          );
        }
      }
    });

    if (typeof adapter.fetchClosedPnl === 'function') {
      const syncState = await withClosedPnlStorage(() =>
        queries.getClosedPnlSyncState(accountId)
      );
      let cursor = syncState?.closed_pnl_cursor || null;
      let latestClosedAt = syncState?.closed_pnl_last_at || null;
      const backfilled = Boolean(syncState?.closed_pnl_backfilled);
      let hasMore = true;
      let pagesFetched = 0;

      while (hasMore && pagesFetched < 5) {
        const startTime = !backfilled && !cursor
          ? undefined
          : latestClosedAt
            ? Math.max(0, new Date(latestClosedAt).getTime() - 60_000)
            : Date.now();
        const page = await fetchFromExchange({
          exchangeCode: connection.exchange_code,
          accountId,
          stage: 'closed P&L sync',
          fetch: () => adapter.fetchClosedPnl({
            ...adapterContext,
            cursor,
            startTime: cursor ? undefined : startTime,
          }),
        });
        if (!page || !Array.isArray(page.trades)) {
          throw new Error(`${connection.exchange_code} adapter returned invalid closed P&L data`);
        }

        cursor = page.nextCursor || null;
        hasMore = Boolean(cursor);
        pagesFetched += 1;
        await withClosedPnlStorage(() => db.tx(async (tx) => {
          for (const trade of page.trades) {
            if (
              !trade.exchangeTradeId ||
              !trade.instrument ||
              !trade.quantity ||
              !trade.exitPrice ||
              trade.realizedPnl === null ||
              trade.realizedPnl === undefined ||
              !trade.closedAt
            ) {
              throw new Error(`${connection.exchange_code} adapter returned an incomplete closed trade`);
            }
            const closedAt = /^\d+$/.test(String(trade.closedAt))
              ? new Date(Number(trade.closedAt))
              : new Date(trade.closedAt);
            if (Number.isNaN(closedAt.getTime())) {
              throw new Error(`${connection.exchange_code} adapter returned an invalid closed-trade date`);
            }
            if (!latestClosedAt || closedAt > new Date(latestClosedAt)) {
              latestClosedAt = closedAt;
            }

            const closedTrade = await queries.upsertClosedTrade(tx, {
              ...trade,
              workspaceId,
              connectionId: connection.id,
              accountId,
              exchangeCode: connection.exchange_code,
              closedAt,
            });
            await events.publish(
              tx,
              'execution.closed_trade_recorded',
              {
                closedTradeId: closedTrade.id,
                accountId,
                exchangeOrderId: trade.exchangeOrderId || null,
                instrument: trade.instrument,
                quantity: trade.quantity,
                entryPrice: trade.entryPrice || null,
                exitPrice: trade.exitPrice,
                realizedPnl: trade.realizedPnl,
                pnlAsset: trade.pnlAsset || null,
                feeAmount: trade.feeAmount || null,
                feeAsset: trade.feeAsset || null,
                closedAt,
              },
              {
                workspaceId,
                resourceType: 'closed_trade',
                resourceId: closedTrade.id,
              },
            );
          }
          await queries.updateClosedPnlSyncState(tx, accountId, {
            cursor,
            lastClosedAt: hasMore ? latestClosedAt : new Date(),
            backfilled: backfilled || !hasMore,
          });
        }));
      }
    }

    const activeOrders = await queries.listOrders(workspaceId, {
      accountId,
      statuses: OPEN_ORDER_STATUSES,
      limit: 200,
    });
    for (const order of activeOrders.rows) {
      if (!order.exchange_order_id || typeof adapter.fetchOrder !== 'function') continue;
      const exchangeOrder = await fetchFromExchange({
        exchangeCode: connection.exchange_code,
        accountId,
        stage: 'order reconciliation',
        fetch: () => adapter.fetchOrder({
          ...adapterContext,
          instrument: order.instrument,
          exchangeOrderId: order.exchange_order_id,
          marketType: order.market_type,
        }),
      });
      if (!exchangeOrder) continue;
      await executionService.handleExecutionUpdate({
        connectionId: connection.id,
        update: exchangeOrder,
      });
    }

    if (typeof adapter.fetchExecutionHistory === 'function') {
      const ordersMissingFills = await queries.listFilledOrdersMissingFills(accountId, { limit: 50 });
      for (const order of ordersMissingFills) {
        let fills;
        try {
          fills = await fetchFromExchange({
            exchangeCode: connection.exchange_code,
            accountId,
            stage: 'spot fill history sync',
            fetch: () => adapter.fetchExecutionHistory({
              ...adapterContext,
              instrument: order.instrument,
              marketType: order.market_type,
              exchangeOrderId: order.exchange_order_id,
              includeFills: true,
            }),
          });
          if (!Array.isArray(fills)) {
            throw new Error(`${connection.exchange_code} adapter returned invalid execution history`);
          }
        } catch (err) {
          logger.warn(
            { err, orderId: order.id, exchangeOrderId: order.exchange_order_id },
            'Historical order fill synchronization failed',
          );
          continue;
        }
        if (fills.length === 0) continue;
        await executionService.handleExecutionUpdate({
          connectionId: connection.id,
          update: {
            exchangeOrderId: order.exchange_order_id,
            status: order.status,
            fills,
          },
        });
      }
    }

    return queries.listPositions(workspaceId, { accountId });
  }

  async function reconcilePendingOrders({ limit = 100 } = {}) {
    const orders = await queries.listOrdersForReconciliation({ limit });
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(5, orders.length) }, async () => {
      while (nextIndex < orders.length) {
        const order = orders[nextIndex];
        nextIndex += 1;
        try {
          const connection = await connections.getConnection(order.connection_id);
          if (!connection || connection.status !== 'active') continue;
          const adapter = await connections.getAdapter(connection.exchange_code);
          if (typeof adapter?.fetchOrder !== 'function') continue;
          const account = await connections.requireAccountAccess({
            accountId: order.account_id,
            workspaceId: order.workspace_id,
            operation: 'execute_trades',
          });
          const credentials = await connections.loadCredentials(connection.id);
          const update = await adapter.fetchOrder({
            ...credentials,
            accountType: account.account_type,
            environment: connection.environment,
            instrument: order.instrument,
            marketType: order.market_type,
            exchangeOrderId: order.exchange_order_id,
            clientOrderId: order.client_order_id,
          });
          const matchesExchangeOrderId = order.exchange_order_id
            ? update?.exchangeOrderId === order.exchange_order_id
            : Boolean(update?.exchangeOrderId);
          const matchesClientOrderId = !update?.clientOrderId ||
            update.clientOrderId === order.client_order_id;
          if (!matchesExchangeOrderId || !matchesClientOrderId) {
            logger.warn(
              {
                orderId: order.id,
                exchangeCode: connection.exchange_code,
                expectedExchangeOrderId: order.exchange_order_id,
                actualExchangeOrderId: update?.exchangeOrderId,
                expectedClientOrderId: order.client_order_id,
                actualClientOrderId: update?.clientOrderId,
              },
              'Periodic reconciliation received a mismatched exchange order identity',
            );
            continue;
          }
          await executionService.handleExecutionUpdate({
            connectionId: connection.id,
            update: {
              ...update,
              clientOrderId: update.clientOrderId || order.client_order_id,
            },
          });
        } catch (err) {
          logger.warn(
            { err, orderId: order.id, exchangeOrderId: order.exchange_order_id },
            'Periodic order reconciliation failed',
          );
        }
      }
    });
    await Promise.all(workers);
    return { checked: orders.length };
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
    reconcilePendingOrders,
    getExecutionRequest,
    getPreferences,
    updatePreferences,
    listSavedViews,
    createSavedView,
    deleteSavedView,
  };
}

export default createTerminalService;