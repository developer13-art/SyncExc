import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMarketplaceQueries } from '../../src/modules/marketplace/marketplace.queries.js';

test('provider listings include realized PnL from linked exchange closed trades', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT provider.*')) {
        return {
          rows: [{ id: 'provider-1', created_at: new Date('2026-10-01T00:00:00.000Z') }],
        };
      }
      if (sql.includes('schema_migrations')) {
        return { rows: [{ applied: true }] };
      }
      if (sql.includes('WITH execution_pnl')) {
        return {
          rows: [
            {
              provider_id: 'provider-1',
              pnl_asset: 'USDT',
              net_pnl: '12.500000000000',
              observed_executions: 2,
              wins: 1,
            },
          ],
        };
      }
      throw new Error('Unexpected marketplace query');
    },
  };

  const { rows } = await createMarketplaceQueries({ db }).listProviders();

  assert.deepEqual(rows[0].realized_pnl_by_asset, [
    {
      asset: 'USDT',
      netPnl: '12.500000000000',
      observedExecutions: 2,
      wins: 1,
    },
  ]);
  const migrationCall = calls.find(({ sql }) => sql.includes('schema_migrations'));
  assert.match(migrationCall.sql, /to_jsonb\(schema_migrations\)->>'filename'/);
  assert.match(migrationCall.sql, /to_jsonb\(schema_migrations\)->>'name'/);
  assert.deepEqual(migrationCall.params, ['045_marketplace_trade_lifecycle.sql']);

  const pnlCall = calls.find(({ sql }) => sql.includes('WITH execution_pnl'));
  assert.match(pnlCall.sql, /JOIN trading_closed_trades exchange_trade/);
  assert.match(pnlCall.sql, /exchange_trade\.id = closed_trade\.closed_trade_id/);
  assert.match(pnlCall.sql, /exchange_trade\.id = signal\.source_closed_trade_id/);
  assert.match(pnlCall.sql, /SUM\(exchange_trade\.realized_pnl\)/);
  assert.match(pnlCall.sql, /NULLIF\(exchange_trade\.fee_asset, ''\)/);
  assert.match(pnlCall.sql, /FROM all_pnl/);
});
