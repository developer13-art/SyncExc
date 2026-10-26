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
        if (sql.includes('WITH realized_trades')) {
          return {
            rows: [{
              closed_trade_count: 2,
              total_realized_pnl: '14.5',
              realized_pnl_today: '2.5',
            }],
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
        if (sql.includes('WITH bucketed_snapshots AS')) return { rows: [] };
        if (sql.includes('FROM exchange_connections')) {
          return {
            rows: [{ total_count: 1, active_count: 0, degraded_count: 1 }],
          };
        }
        assert.fail(`Unexpected overview query: ${sql}`);
      },
    },
    queries: {
      async listTradesForScope(workspaceId, options) {
        assert.equal(workspaceId, 'workspace-id');
        assert.equal(options.limit, 5);
        return {
          rows: [{
            id: 'closed-trade-id',
            order_id: null,
            exchange_trade_id: 'exchange-trade-id',
            instrument: 'BTCUSDT',
            side: 'long',
            quantity: '0.01',
            entry_price: '60000',
            price: '61000',
            fee_amount: '0.2',
            fee_asset: 'USDT',
            realized_pnl: '10',
            executed_at: '2026-10-22T07:00:00.000Z',
          }],
        };
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
  assert.equal(overview.realizedPnlToday, '2.5');
  assert.deepEqual(overview.closedTrades, { count: 2, totalRealizedPnl: '14.5' });
  assert.deepEqual(overview.recentTrades, [{
    id: 'closed-trade-id',
    orderId: null,
    exchangeTradeId: 'exchange-trade-id',
    instrument: 'BTCUSDT',
    side: 'long',
    quantity: '0.01',
    filledQuantity: '0.01',
    entryPrice: '60000',
    price: '61000',
    averagePrice: '61000',
    fees: '0.2',
    feeAsset: 'USDT',
    realizedPnl: '10',
    closedAt: '2026-10-22T07:00:00.000Z',
    status: 'closed',
  }]);
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
        if (sql.includes('FROM trading_closed_trades')) {
          return { rows: [{ closed_trade_count: 0, total_realized_pnl: '0', realized_pnl_today: '0' }] };
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
        if (sql.includes('WITH bucketed_snapshots AS')) return { rows: [] };
        if (sql.includes('FROM exchange_connections')) {
          return { rows: [{ total_count: 1, active_count: 1, degraded_count: 0 }] };
        }
        assert.fail(`Unexpected overview query: ${sql}`);
      },
    },
    queries: { listTradesForScope: async () => ({ rows: [] }) },
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
        if (sql.includes('FROM trading_closed_trades')) {
          return { rows: [{ closed_trade_count: 0, total_realized_pnl: '0', realized_pnl_today: '0' }] };
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
        if (sql.includes('WITH bucketed_snapshots AS')) return { rows: [] };
        if (sql.includes('FROM exchange_connections')) {
          return { rows: [{ total_count: 1, active_count: 1, degraded_count: 0 }] };
        }
        assert.fail(`Unexpected overview query: ${sql}`);
      },
    },
    queries: { listTradesForScope: async () => ({ rows: [] }) },
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

test('builds portfolio history from complete balance snapshots and current spot prices', async () => {
  const currentTime = Date.now();
  const olderSnapshot = new Date(currentTime - (2 * 60 * 60 * 1000));
  const newerSnapshot = new Date(currentTime - (60 * 60 * 1000));
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
        if (sql.includes('FROM trading_closed_trades')) {
          return { rows: [{ closed_trade_count: 0, total_realized_pnl: '0', realized_pnl_today: '0' }] };
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
              balances: [{ asset: 'USDT', total: '50' }],
              equity: null,
            }],
          };
        }
        if (sql.includes('WITH bucketed_snapshots AS')) {
          return {
            rows: [
              {
                bucket: olderSnapshot,
                account_id: 'account-id',
                exchange_code: 'bybit',
                observed_at: olderSnapshot,
                balances: [
                  { asset: 'BTC', total: '0.01' },
                  { asset: 'USDT', total: '50' },
                ],
                equity: null,
              },
              {
                bucket: newerSnapshot,
                account_id: 'account-id',
                exchange_code: 'bybit',
                observed_at: newerSnapshot,
                balances: [
                  { asset: 'BTC', total: '0.02' },
                  { asset: 'USDT', total: '50' },
                ],
                equity: null,
              },
            ],
          };
        }
        if (sql.includes('FROM exchange_connections')) {
          return { rows: [{ total_count: 1, active_count: 1, degraded_count: 0 }] };
        }
        assert.fail(`Unexpected overview query: ${sql}`);
      },
    },
    queries: { listTradesForScope: async () => ({ rows: [] }) },
    marketData: {
      getSpotPrice: async ({ symbol }) => {
        assert.equal(symbol, 'BTCUSDT');
        return 50000;
      },
    },
    logger: { warn: assert.fail },
  });

  const overview = await service.getWorkspaceOverview({ workspaceId: 'workspace-id' });

  assert.equal(overview.equitySeries['1d'].length, 2);
  assert.deepEqual(
    overview.equitySeries['1d'].map((point) => point.value),
    [550, 1050],
  );
  assert.equal(overview.equityChange['1d'].absolute, 500);
  assert.equal(overview.equityChange['1d'].percent, (500 / 550) * 100);
});
