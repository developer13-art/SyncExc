import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTerminalQueries } from '../../src/modules/terminal/terminal.queries.js';

test('filters trade history by the selected account', async () => {
  let queryText;
  let queryParams;
  const executedAt = new Date('2026-10-21T09:00:00.000Z');
  const queries = createTerminalQueries({
    db: {
      async query(text, params) {
        queryText = text;
        queryParams = params;
        return {
          rows: [{ executed_at: executedAt }],
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

  assert.match(queryText, /JOIN trading_orders o ON o\.id = f\.order_id/);
  assert.match(queryText, /o\.account_id = \$2/);
  assert.match(queryText, /f\.instrument = \$3/);
  assert.match(queryText, /f\.executed_at < \$4/);
  assert.match(queryText, /LIMIT \$5/);
  assert.deepEqual(queryParams, [
    'workspace-id',
    'account-id',
    '0GUSDT',
    '2026-10-20T09:00:00.000Z',
    51,
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.nextCursor, null);
});
