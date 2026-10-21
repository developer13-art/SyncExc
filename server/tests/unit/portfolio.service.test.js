import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPortfolioService } from '../../src/modules/terminal/portfolio.service.js';

test('includes workspace exchange accounts and latest asset balances in overview', async () => {
  const service = createPortfolioService({
    db: {
      query: async (sql, params) => {
        assert.deepEqual(params, ['workspace-id']);
        if (sql.includes('FROM trading_orders')) return { rows: [] };
        if (sql.includes('FROM trading_positions')) {
          return {
            rows: [{ position_count: 0, total_unrealized_pnl: '0' }],
          };
        }
        if (sql.includes('FROM trading_fills')) {
          return { rows: [{ fill_count: 0, total_notional: '0' }] };
        }
        if (sql.includes('FROM trading_execution_requests')) return { rows: [] };
        if (sql.includes('FROM exchange_accounts a')) {
          return {
            rows: [
              {
                id: 'account-id',
                connection_id: 'connection-id',
                account_type: 'unified',
                status: 'active',
                label: 'Bybit Demo',
                exchange_code: 'bybit',
                connection_status: 'degraded',
                health_status: 'healthy',
                last_synced_at: '2026-10-19T14:00:00.000Z',
                balances: [
                  { asset: 'USDT', free: '50', used: '0', total: '50' },
                  { asset: 'BTC', free: '0.01', used: '0', total: '0.01' },
                ],
                equity: null,
              },
            ],
          };
        }
        if (sql.includes('FROM exchange_connections')) {
          return {
            rows: [{ total_count: 1, active_count: 0, degraded_count: 1 }],
          };
        }
        assert.fail(`Unexpected overview query: ${sql}`);
      },
    },
  });

  const overview = await service.getWorkspaceOverview({ workspaceId: 'workspace-id' });

  assert.deepEqual(overview.accounts, [
    {
      id: 'account-id',
      connectionId: 'connection-id',
      label: 'Bybit Demo',
      exchangeName: 'bybit',
      type: 'unified',
      status: 'active',
      connectionStatus: 'degraded',
      healthStatus: 'degraded',
      lastSyncedAt: '2026-10-19T14:00:00.000Z',
      balances: [
        { asset: 'USDT', free: '50', used: '0', total: '50' },
        { asset: 'BTC', free: '0.01', used: '0', total: '0.01' },
      ],
      equity: null,
      equitySource: null,
      unpricedAssets: ['BTC'],
    },
  ]);
  assert.equal(overview.portfolioValue, null);
  assert.equal(overview.activeConnectionCount, 0);
  assert.equal(overview.totalConnectionCount, 1);
  assert.equal(overview.degradedConnectionCount, 1);
});

test('estimates USD portfolio value from balance quantities and exchange spot prices', async () => {
  const service = createPortfolioService({
    db: {
      query: async (sql) => {
        if (sql.includes('FROM trading_orders')) return { rows: [] };
        if (sql.includes('FROM trading_positions')) {
          return { rows: [{ position_count: 0, total_unrealized_pnl: '0' }] };
        }
        if (sql.includes('FROM trading_fills')) {
          return { rows: [{ fill_count: 0, total_notional: '0' }] };
        }
        if (sql.includes('FROM trading_execution_requests')) return { rows: [] };
        if (sql.includes('FROM exchange_accounts a')) {
          return {
            rows: [{
              id: 'account-id',
              connection_id: 'connection-id',
              account_type: 'unified',
              status: 'active',
              label: 'Bybit Demo',
              exchange_code: 'bybit',
              connection_status: 'active',
              health_status: 'healthy',
              balances: [
                { asset: 'BTC', total: '0.01' },
                { asset: 'USDT', total: '50' },
              ],
              equity: null,
            }],
          };
        }
        if (sql.includes('FROM exchange_connections')) {
          return { rows: [{ total_count: 1, active_count: 1, degraded_count: 0 }] };
        }
        assert.fail(`Unexpected overview query: ${sql}`);
      },
    },
    marketData: {
      getSpotPrice: async ({ exchangeCode, symbol }) => {
        assert.equal(exchangeCode, 'bybit');
        assert.equal(symbol, 'BTCUSDT');
        return 50000;
      },
    },
    logger: { warn: assert.fail },
  });

  const overview = await service.getWorkspaceOverview({ workspaceId: 'workspace-id' });

  assert.equal(overview.portfolioValue, 550);
  assert.equal(overview.portfolioValueEstimated, true);
  assert.equal(overview.accounts[0].equity, 550);
  assert.equal(overview.accounts[0].equitySource, 'estimated');
  assert.deepEqual(overview.unpricedAssets, []);
});

test('does not report a partial portfolio total when an asset has no USD price', async () => {
  const service = createPortfolioService({
    db: {
      query: async (sql) => {
        if (sql.includes('FROM trading_orders')) return { rows: [] };
        if (sql.includes('FROM trading_positions')) {
          return { rows: [{ position_count: 0, total_unrealized_pnl: '0' }] };
        }
        if (sql.includes('FROM trading_fills')) {
          return { rows: [{ fill_count: 0, total_notional: '0' }] };
        }
        if (sql.includes('FROM trading_execution_requests')) return { rows: [] };
        if (sql.includes('FROM exchange_accounts a')) {
          return {
            rows: [{
              id: 'account-id',
              connection_id: 'connection-id',
              account_type: 'unified',
              status: 'active',
              label: 'Bybit Demo',
              exchange_code: 'bybit',
              connection_status: 'active',
              health_status: 'healthy',
              balances: [{ asset: 'UNKNOWN', total: '2' }],
              equity: null,
            }],
          };
        }
        if (sql.includes('FROM exchange_connections')) {
          return { rows: [{ total_count: 1, active_count: 1, degraded_count: 0 }] };
        }
        assert.fail(`Unexpected overview query: ${sql}`);
      },
    },
    marketData: {
      getSpotPrice: async () => {
        throw new Error('price unavailable');
      },
    },
    logger: { warn() {} },
  });

  const overview = await service.getWorkspaceOverview({ workspaceId: 'workspace-id' });

  assert.equal(overview.portfolioValue, null);
  assert.equal(overview.portfolioValueEstimated, false);
  assert.deepEqual(overview.unpricedAssets, ['UNKNOWN']);
});
