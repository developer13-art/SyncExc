import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPerformanceService } from '../../src/modules/marketplace/performance.service.js';

test('returns exact performance grouped by settlement asset without cross-asset sums', async () => {
  const queries = [];
  const service = createPerformanceService({
    db: {
      async query(sql) {
        queries.push(sql);
        if (sql.includes('observed_executions')) {
          return {
            rows: [
              {
                pnl_asset: 'USDT',
                observed_executions: 2,
                wins: 1,
                losses: 1,
                breakeven: 0,
                net_pnl: '3.250000000000',
              },
              {
                pnl_asset: 'BTC',
                observed_executions: 1,
                wins: 1,
                losses: 0,
                breakeven: 0,
                net_pnl: '0.001000000000',
              },
              {
                pnl_asset: 'UNKNOWN',
                observed_executions: 1,
                wins: 1,
                losses: 0,
                breakeven: 0,
                net_pnl: '2.000000000000',
              },
            ],
          };
        }
        if (sql.includes('daily_pnl')) {
          return {
            rows: [
              { pnl_asset: 'USDT', timestamp: '2026-10-22T00:00:00.000Z', value: '3.250000000000' },
              { pnl_asset: 'BTC', timestamp: '2026-10-23T00:00:00.000Z', value: '0.001000000000' },
              { pnl_asset: 'UNKNOWN', timestamp: '2026-10-24T00:00:00.000Z', value: '2.000000000000' },
            ],
          };
        }
        if (sql.includes('marketplace_published_signals')) {
          return { rows: [{ count: 4 }] };
        }
        throw new Error('Unexpected performance query');
      },
    },
    queries: {
      async findProviderById() {
        return { id: 'provider-1' };
      },
    },
    logger: { warn() {}, error() {} },
  });

  const result = await service.getProviderPerformance({ providerId: 'provider-1' });

  assert.equal(result.metrics.totalSignals, 4);
  assert.equal(result.metrics.observedExecutions, 4);
  assert.equal(result.metrics.winRate, 75);
  assert.deepEqual(
    result.metrics.realizedPnlByAsset.map(({ asset, netPnl }) => [asset, netPnl]),
    [
      ['USDT', '3.250000000000'],
      ['BTC', '0.001000000000'],
      ['UNKNOWN', '2.000000000000'],
    ],
  );
  assert.equal(result.seriesByAsset.USDT.all[0].value, 3.25);
  assert.equal(result.seriesByAsset.BTC.all[0].value, 0.001);
  assert.equal(result.seriesByAsset.UNKNOWN.all[0].value, 2);
  assert.equal(Object.hasOwn(result.metrics, 'realizedPnl'), false);
  const metricsQuery = queries.find((sql) => sql.includes('observed_executions'));
  assert.ok(metricsQuery);
  const normalizedMetricsQuery = metricsQuery.replace(/\s+/g, ' ');
  assert.match(
    normalizedMetricsQuery,
    /execution_pnl AS \( SELECT execution\.id AS execution_id, COALESCE\(NULLIF\(closed_trade\.pnl_asset, ''\), NULLIF\(exchange_trade\.fee_asset, ''\), 'UNKNOWN'\) AS pnl_asset, SUM\(exchange_trade\.realized_pnl\) AS realized_pnl FROM marketplace_signal_closed_trades closed_trade JOIN trading_closed_trades exchange_trade ON exchange_trade\.id = closed_trade\.closed_trade_id/
  );
  assert.match(
    normalizedMetricsQuery,
    /source_signal_pnl AS \( SELECT signal\.id AS execution_id, COALESCE\(NULLIF\(signal\.pnl_asset, ''\), MAX\(NULLIF\(exchange_trade\.fee_asset, ''\)\), 'UNKNOWN'\) AS pnl_asset, SUM\(exchange_trade\.realized_pnl\) AS realized_pnl FROM marketplace_published_signals signal JOIN trading_closed_trades exchange_trade/
  );
  assert.match(normalizedMetricsQuery, /exchange_trade\.id = signal\.source_closed_trade_id/);
  assert.match(normalizedMetricsQuery, /exchange_trade\.account_id = signal\.source_account_id/);
  assert.match(normalizedMetricsQuery, /exchange_trade\.closed_at <= signal\.closed_at/);
  const seriesQuery = queries.find((sql) => sql.includes('daily_pnl'));
  assert.ok(seriesQuery);
  assert.match(seriesQuery, /JOIN trading_closed_trades exchange_trade/);
  assert.match(seriesQuery, /SUM\(exchange_trade\.realized_pnl\)/);
  assert.match(seriesQuery, /date_trunc\('day', exchange_trade\.closed_at\)/);
  assert.match(seriesQuery, /NULLIF\(exchange_trade\.fee_asset, ''\)/);
  assert.doesNotMatch(seriesQuery, /WHERE pnl_asset <> 'UNKNOWN'/);
});
