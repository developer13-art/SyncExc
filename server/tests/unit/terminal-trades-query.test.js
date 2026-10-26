import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTerminalQueries } from '../../src/modules/terminal/terminal.queries.js';

test('filters trade history by the selected account', async () => {
  const queriesMade = [];
  const executedAt = new Date('2026-10-21T09:00:00.000Z');
  const queries = createTerminalQueries({
    db: {
      async query(text, params) {
        queriesMade.push({ text, params });
        return {
          rows: text.includes('count(*)')
            ? [{ total: 61 }]
            : [{ executed_at: executedAt }],
        };
      },
    },
  });

  const result = await queries.listTradesForScope('workspace-id', {
    accountId: 'account-id',
    instrument: '0GUSDT',
    cursor: '2026-10-20T09:00:00.000Z',
    limit: 50,
  });

  const queryText = queriesMade[1].text;
  const queryParams = queriesMade[1].params;
  assert.match(queryText, /JOIN trading_orders o ON o\.id = f\.order_id/);
  assert.match(queryText, /t\.account_id = \$2/);
  assert.match(queryText, /t\.instrument = \$3/);
  assert.match(queryText, /t\.executed_at < \$4/);
  assert.match(queryText, /FROM trading_closed_trades ct/);
  assert.match(queryText, /LIMIT \$5/);
  assert.match(queryText, /OFFSET \$6/);
  assert.deepEqual(queryParams, [
    'workspace-id',
    'account-id',
    '0GUSDT',
    '2026-10-20T09:00:00.000Z',
    51,
    0,
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.nextCursor, null);
  assert.equal(result.total, 61);
});

test('pages through retained trades and reports the full filtered count', async () => {
  const queriesMade = [];
  const executedAt = new Date('2026-10-21T09:00:00.000Z');
  const queries = createTerminalQueries({
    db: {
      async query(text, params) {
        queriesMade.push({ text, params });
        return {
          rows: text.includes('count(*)')
            ? [{ total: 71 }]
            : Array.from({ length: 26 }, () => ({ executed_at: executedAt })),
        };
      },
    },
  });

  const result = await queries.listTradesForScope('workspace-id', {
    page: 3,
    pageSize: 25,
  });

  assert.deepEqual(queriesMade[1].params, ['workspace-id', 26, 50]);
  assert.equal(result.rows.length, 25);
  assert.equal(result.total, 71);
  assert.equal(result.nextCursor, executedAt.toISOString());
});

test('treats blank optional order numerics as absent', async () => {
  let queryParams;
  const queries = createTerminalQueries({
    db: {
      async query(_text, params) {
        queryParams = params;
        return { rows: [] };
      },
    },
  });

  await queries.updateOrder('order-id', {
    filledQuantity: ' ',
    remainingQuantity: '',
    averageFillPrice: '\t',
  });

  assert.deepEqual(queryParams, [
    'order-id',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ]);
});

test('records FIFO realized P&L on spot sell fills including quote-currency fees', async () => {
  const lots = [];
  let nextLotId = 0;
  const client = {
    async query(text, params) {
      if (text.includes('SELECT i.base_asset, i.quote_asset')) {
        return { rows: [{ base_asset: 'BTC', quote_asset: 'USDT' }] };
      }
      if (text.includes('INSERT INTO trading_spot_lots')) {
        lots.push({
          id: `lot-${++nextLotId}`,
          remaining_quantity: params[6],
          cost_basis_per_unit: params[7],
          cost_basis_known: params[8],
        });
        return { rows: [] };
      }
      if (text.includes('SELECT id, remaining_quantity::text')) {
        return { rows: lots.filter((lot) => Number(lot.remaining_quantity) > 0) };
      }
      if (text.includes('UPDATE trading_spot_lots SET remaining_quantity')) {
        const lot = lots.find((item) => item.id === params[0]);
        lot.remaining_quantity = String(Number(lot.remaining_quantity) - Number(params[1]));
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  const queries = createTerminalQueries({ db: {} });
  const order = {
    id: 'order-id',
    workspace_id: 'workspace-id',
    connection_id: 'connection-id',
    account_id: 'account-id',
    instrument: 'BTCUSDT',
    side: 'buy',
  };

  await queries.recordSpotFillFifo(client, {
    fillId: 'buy-fill',
    order,
    fill: {
      quantity: '1',
      price: '10000',
      feeAmount: '0.1',
      feeAsset: 'USDT',
      executedAt: new Date('2026-10-20T09:00:00.000Z'),
    },
  });

  const realized = await queries.recordSpotFillFifo(client, {
    fillId: 'sell-fill',
    order: { ...order, side: 'sell' },
    fill: {
      quantity: '0.4',
      price: '11000',
      feeAmount: '0.05',
      feeAsset: 'USDT',
      executedAt: new Date('2026-10-21T09:00:00.000Z'),
    },
  });

  assert.deepEqual(realized, {
    entryPrice: '10000.1',
    realizedPnl: '399.91',
    matchedQuantity: '0.4',
  });
  assert.equal(lots[0].remaining_quantity, '0.6');
});
