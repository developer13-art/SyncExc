import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTerminalService } from '../../src/modules/terminal/terminal.service.js';

test('syncs exchange positions and refreshes active order status', async () => {
  const calls = [];
  const currentPosition = {
    instrument: 'OGUSDT',
    side: 'long',
    quantity: '100',
    entryPrice: '0.2382',
    markPrice: '0.2404',
    unrealizedPnl: '0.22',
    leverage: '10',
    liquidationPrice: '0',
  };
  const queries = {
    async listOrders(_workspaceId, options) {
      calls.push(['listOrders', options]);
      return {
        rows: [{
          exchange_order_id: 'exchange-order-id',
          instrument: 'OGUSDT',
          market_type: 'futures',
        }],
      };
    },
    async upsertPosition(_tx, position) {
      calls.push(['upsertPosition', position]);
      return { id: 'position-id' };
    },
    async insertPositionSnapshot(_tx, snapshot) {
      calls.push(['insertPositionSnapshot', snapshot]);
    },
    async clearMissingPositions(_tx, accountId, positions) {
      calls.push(['clearMissingPositions', accountId, positions]);
    },
    async listPositions(_workspaceId, params) {
      calls.push(['listPositions', params]);
      return [currentPosition];
    },
  };
  const connections = {
    async requireAccountAccess() {
      return { id: 'account-id', connection_id: 'connection-id', account_type: 'unified', status: 'active' };
    },
    async getConnection() {
      return { id: 'connection-id', exchange_code: 'bybit', environment: 'demo', status: 'active' };
    },
    async getAdapter() {
      return {
        async fetchPositions(context) {
          calls.push(['fetchPositions', context]);
          return [currentPosition];
        },
        async fetchAccountState(context) {
          calls.push(['fetchAccountState', context]);
          return {
            balances: [{ asset: 'DOGE', free: '10', used: '0', total: '10' }],
            equity: '100',
          };
        },
        async fetchOrder(params) {
          calls.push(['fetchOrder', params]);
          return {
            exchangeOrderId: 'exchange-order-id',
            status: 'filled',
            filledQuantity: '100',
            remainingQuantity: '0',
            averageFillPrice: '0.2382',
          };
        },
      };
    },
    async loadCredentials() {
      return { apiKey: 'key', apiSecret: 'secret' };
    },
  };
  const db = {
    async tx(callback) {
      return callback({
        query: async (sql) => ({
          rows: sql.includes('INSERT INTO exchange_balance_snapshots')
            ? [{ id: 'balance-snapshot-id' }]
            : [],
        }),
      });
    },
  };
  const executionService = {
    async handleExecutionUpdate(params) {
      calls.push(['handleExecutionUpdate', params]);
    },
  };
  const service = createTerminalService({
    db,
    queries,
    connections,
    executionService,
    marketData: {},
    events: {},
    audit: {},
    logger: {},
  });

  const positions = await service.syncAccountState({
    workspaceId: 'workspace-id',
    accountId: 'account-id',
  });

  assert.deepEqual(positions, [currentPosition]);
  assert.ok(calls.some(([name, value]) => name === 'upsertPosition' && value.quantity === '100'));
  assert.ok(calls.some(([name, value]) => name === 'fetchAccountState' && value.accountType === 'unified'));
  assert.ok(calls.some(([name]) => name === 'clearMissingPositions'));
  assert.ok(calls.some(([name, value]) => name === 'handleExecutionUpdate' && value.update.status === 'filled'));
});
