import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPerformanceService } from '../../src/modules/marketplace/performance.service.js';

test('returns exact performance grouped by settlement asset without cross-asset sums', async () => {
  const service = createPerformanceService({
    db: {
      async query(sql) {
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
            ],
          };
        }
        if (sql.includes('daily_pnl')) {
          return {
            rows: [
              { pnl_asset: 'USDT', timestamp: '2026-10-22T00:00:00.000Z', value: '3.250000000000' },
              { pnl_asset: 'BTC', timestamp: '2026-10-23T00:00:00.000Z', value: '0.001000000000' },
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
  assert.equal(result.metrics.observedExecutions, 3);
  assert.ok(Math.abs(result.metrics.winRate - (200 / 3)) < 1e-12);
  assert.deepEqual(
    result.metrics.realizedPnlByAsset.map(({ asset, netPnl }) => [asset, netPnl]),
    [
      ['USDT', '3.250000000000'],
      ['BTC', '0.001000000000'],
    ],
  );
  assert.equal(result.seriesByAsset.USDT.all[0].value, 3.25);
  assert.equal(result.seriesByAsset.BTC.all[0].value, 0.001);
  assert.equal(Object.hasOwn(result.metrics, 'realizedPnl'), false);
});
