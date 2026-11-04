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

test('payout requests reserve every available earning for one currency with an exact minor-unit total', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT id, trader_net_amount_minor')) {
        return {
          rows: [
            { id: 'earning-1', trader_net_amount_minor: '1200' },
            { id: 'earning-2', trader_net_amount_minor: '350' },
          ],
        };
      }
      if (sql.includes('INSERT INTO marketplace_trader_payout_requests')) {
        assert.deepEqual(params, [
          'provider-1',
          'user-1',
          'USD',
          '1550',
          'encrypted-account',
          'Trader Name',
          'Example Bank',
          'NG',
          '1234',
        ]);
        return { rows: [{ id: 'request-1', amount_minor: '1550', currency: 'USD' }] };
      }
      if (sql.includes('UPDATE marketplace_trader_earnings')) {
        assert.deepEqual(params, ['request-1', ['earning-1', 'earning-2']]);
        return { rowCount: 2, rows: [] };
      }
      throw new Error('Unexpected payout request query');
    },
  };

  const request = await createMarketplaceQueries({ db: {} })
    .createMarketplaceTraderPayoutRequest(client, {
      providerId: 'provider-1',
      requestedBy: 'user-1',
      currency: 'USD',
      accountName: 'Trader Name',
      bankName: 'Example Bank',
      countryCode: 'NG',
      encryptedAccountNumber: 'encrypted-account',
      accountLast4: '1234',
    });

  assert.equal(request.amount_minor, '1550');
  assert.equal(calls.length, 3);
  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.match(calls[1].sql, /payout_account_encrypted/);
});

test('marking a payout request paid settles its reserved earnings with the same transfer reference', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT * FROM marketplace_trader_payout_requests')) {
        return { rows: [{ id: 'request-1', status: 'pending' }] };
      }
      if (sql.includes('UPDATE marketplace_trader_earnings')) {
        assert.deepEqual(params, ['request-1', 'bank-transfer-1', 'November payout', 'admin-1']);
        return { rows: [{ id: 'earning-1' }] };
      }
      if (sql.includes('UPDATE marketplace_trader_payout_requests')) {
        return { rows: [{ id: 'request-1', status: 'paid', payout_reference: 'bank-transfer-1' }] };
      }
      throw new Error('Unexpected payout settlement query');
    },
  };

  const result = await createMarketplaceQueries({ db: {} })
    .markMarketplaceTraderPayoutRequestPaid(client, {
      requestId: 'request-1',
      actorId: 'admin-1',
      payoutReference: 'bank-transfer-1',
      note: 'November payout',
    });

  assert.equal(result.status, 'paid');
  assert.equal(calls.length, 3);
  assert.match(calls[0].sql, /FOR UPDATE/);
});

test('rejecting a payout request releases reserved earnings for another request', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('UPDATE marketplace_trader_payout_requests')) {
        assert.deepEqual(params, ['request-1', 'admin-1', 'Please update payout account details']);
        return { rows: [{ id: 'request-1', status: 'rejected' }] };
      }
      if (sql.includes('UPDATE marketplace_trader_earnings')) {
        assert.deepEqual(params, ['request-1']);
        return { rowCount: 1, rows: [] };
      }
      throw new Error('Unexpected payout rejection query');
    },
  };

  const result = await createMarketplaceQueries({ db: {} })
    .rejectMarketplaceTraderPayoutRequest(client, {
      requestId: 'request-1',
      actorId: 'admin-1',
      note: 'Please update payout account details',
    });

  assert.equal(result.status, 'rejected');
  assert.equal(calls.length, 2);
});

test('admin active subscription query includes subscriber identities and confirmed payment totals', async () => {
  let sql;
  const db = {
    async query(queryText, params) {
      sql = queryText;
      assert.deepEqual(params, [25, 0]);
      return {
        rows: [{
          id: 'subscription-1',
          subscriber_email: 'subscriber@example.test',
          total_gross_minor: '1200',
          total_trader_net_minor: '1176',
          total_count: '1',
        }],
      };
    },
  };

  const result = await createMarketplaceQueries({ db })
    .listMarketplaceTraderSubscriptionsForAdmin({ limit: 25, offset: 0 });

  assert.equal(result.total, 1);
  assert.equal(result.items[0].subscriber_email, 'subscriber@example.test');
  assert.equal(result.items[0].total_gross_minor, '1200');
  assert.match(sql, /subscriber\.email AS subscriber_email/);
  assert.match(sql, /SUM\(earning\.gross_amount_minor\)/);
});
