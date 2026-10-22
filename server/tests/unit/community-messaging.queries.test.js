import test from 'node:test';
import assert from 'node:assert/strict';

import { createMessagingQueries } from '../../src/modules/community/messaging.queries.js';

test('conversation and request lists include account profile pictures as a fallback', async () => {
  const calls = [];
  const queries = createMessagingQueries({
    db: {
      query: async (sql, params = []) => {
        calls.push({ sql, params });
        return { rows: [] };
      },
    },
  });

  await queries.listConversations('viewer-id');
  await queries.listRequests('viewer-id');

  assert.equal(calls.length, 2);
  for (const { sql } of calls) {
    assert.match(sql, /COALESCE\(p\.avatar_url, u\.avatar_url\) AS other_avatar_url/);
    assert.match(sql, /LEFT JOIN community_profiles p ON p\.user_id = u\.id/);
    assert.match(sql, /JOIN users u/);
  }
});
