import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExternalProviderError } from '../../src/lib/errors.js';
import { createTerminalService } from '../../src/modules/terminal/terminal.service.js';

test('backfills and persists exchange closed P&L during account sync', async () => {
  const persistedTrades = [];
  const syncStates = [];
  let requestedPage;
  const closedTrade = {
    exchangeTradeId: 'close-order:1720000000000:1720000001000:0.25',
    exchangeOrderId: 'close-order',
    instrument: 'BTCUSDT',
    side: 'long',
    quantity: '0.25',
    entryPrice: '60000',
    exitPrice: '61000',
    realizedPnl: '250',
    pnlAsset: 'USDT',
    feeAmount: '1.5',
    feeAsset: 'USDT',
    closedAt: '1720000001000',
    exchangePayload: {},
  };
  const queries = {
    async getClosedPnlSyncState() {
      return null;
    },
    async upsertClosedTrade(_tx, trade) {
      persistedTrades.push(trade);
      return { id: 'closed-trade-id' };
    },
    async updateClosedPnlSyncState(_tx, _accountId, state) {
      syncStates.push(state);
    },
    async listOrders() {
      return { rows: [] };
    },
    async upsertPosition() {
      throw new Error('No positions should be written for this fixture');
    },
    async clearMissingPositions() {},
    async listPositions() {
      return [];
    },
  };
  const service = createTerminalService({
    db: {
      async tx(callback) {
        return callback({});
      },
    },
    queries,
    connections: {
      async requireAccountAccess() {
        return {
          id: 'account-id',
          connection_id: 'connection-id',
          account_type: 'unified',
          status: 'active',
        };
      },
      async getConnection() {
        return {
          id: 'connection-id',
          exchange_code: 'bybit',
          environment: 'demo',
          status: 'active',
        };
      },
      async getAdapter() {
        return {
          async fetchPositions() {
            return [];
          },
          async fetchClosedPnl(context) {
            requestedPage = context;
            return { trades: [closedTrade], nextCursor: null };
          },
        };
      },
      async loadCredentials() {
        return { apiKey: 'key', apiSecret: 'secret' };
      },
    },
    executionService: {},
    marketData: {},
    events: {
      async publish(_tx, eventName, payload) {
        assert.equal(eventName, 'execution.closed_trade_recorded');
        assert.equal(payload.pnlAsset, 'USDT');
      },
    },
    audit: {},
    logger: {},
  });

  await service.syncAccountState({
    workspaceId: 'workspace-id',
    accountId: 'account-id',
  });

  assert.equal(requestedPage.cursor, null);
  assert.equal(requestedPage.startTime, undefined);
  assert.equal(persistedTrades.length, 1);
  assert.equal(persistedTrades[0].accountId, 'account-id');
  assert.equal(persistedTrades[0].workspaceId, 'workspace-id');
  assert.equal(persistedTrades[0].realizedPnl, '250');
  assert.equal(persistedTrades[0].pnlAsset, 'USDT');
  assert.equal(persistedTrades[0].closedAt.toISOString(), '2024-07-03T09:46:41.000Z');
  assert.equal(syncStates.length, 1);
  assert.equal(syncStates[0].cursor, null);
  assert.ok(syncStates[0].lastClosedAt instanceof Date);
  assert.ok(Date.now() - syncStates[0].lastClosedAt.getTime() < 1_000);
  assert.equal(syncStates[0].backfilled, true);
});

test('returns an actionable exchange error when closed P&L fetch fails', async () => {
  const loggedFailures = [];
  const service = createSyncService({
    queries: {
      async getClosedPnlSyncState() {
        return null;
      },
    },
    adapter: {
      async fetchPositions() {
        return [];
      },
      async fetchClosedPnl() {
        throw new ExternalProviderError('Bybit closed P&L sync failed: permission denied', {
          provider: 'bybit',
          details: { providerCode: 10005, stage: 'closed P&L sync' },
        });
      },
    },
    logger: {
      error(context, message) {
        loggedFailures.push({ context, message });
      },
    },
  });

  await assert.rejects(
    service.syncAccountState({ workspaceId: 'workspace-id', accountId: 'account-id' }),
    (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.code, 'EXTERNAL_PROVIDER_ERROR');
      assert.match(error.message, /permission denied/);
      return true;
    }
  );
  assert.equal(loggedFailures.length, 1);
  assert.equal(loggedFailures[0].context.stage, 'closed P&L sync');
});

test('reports an unapplied closed-trade migration instead of a generic server error', async () => {
  const service = createSyncService({
    queries: {
      async getClosedPnlSyncState() {
        throw Object.assign(new Error('relation does not exist'), { code: '42P01' });
      },
    },
    adapter: {
      async fetchPositions() {
        return [];
      },
      async fetchClosedPnl() {
        throw new Error('Should not fetch history before reading sync state');
      },
    },
  });

  await assert.rejects(
    service.syncAccountState({ workspaceId: 'workspace-id', accountId: 'account-id' }),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.code, 'TERMINAL_SYNC_SCHEMA_MISSING');
      assert.match(error.message, /Run the pending database migrations/);
      assert.equal(error.details.migration, '033_terminal_closed_trade_history.sql');
      return true;
    }
  );
});

function createSyncService({ queries, adapter, logger = {} }) {
  const completeQueries = {
    async upsertPosition() {
      throw new Error('No positions should be written for this fixture');
    },
    async clearMissingPositions() {},
    async listOrders() {
      return { rows: [] };
    },
    async listPositions() {
      return [];
    },
    ...queries,
  };
  return createTerminalService({
    db: {
      async tx(callback) {
        return callback({});
      },
    },
    queries: completeQueries,
    connections: {
      async requireAccountAccess() {
        return {
          id: 'account-id',
          connection_id: 'connection-id',
          account_type: 'unified',
          status: 'active',
        };
      },
      async getConnection() {
        return {
          id: 'connection-id',
          exchange_code: 'bybit',
          environment: 'demo',
          status: 'active',
        };
      },
      async getAdapter() {
        return adapter;
      },
      async loadCredentials() {
        return { apiKey: 'key', apiSecret: 'secret' };
      },
    },
    executionService: {},
    marketData: {},
    events: {},
    audit: {},
    logger,
  });
}
