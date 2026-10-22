import test from 'node:test';
import assert from 'node:assert/strict';

import { createSearchService } from '../../src/modules/community/search.service.js';

test('profile-only search supports an empty query for community discovery', async () => {
  const calls = [];
  const service = createSearchService({
    db: { tx: async () => assert.fail('empty discovery searches are not recorded') },
    queries: {
      searchProfiles: async (params) => {
        calls.push(params);
        return [{
          id: 'user-2',
          user_id: 'user-2',
          handle: 'member',
          display_name: 'Community Member',
        }];
      },
    },
    logger: {},
  });

  const result = await service.search({
    userId: 'user-1',
    query: '',
    filters: { types: ['profiles'] },
  });

  assert.equal(result.resultCount, 1);
  assert.equal(result.results.profiles[0].userId, 'user-2');
  assert.deepEqual(calls, [{ query: '', userId: 'user-1', limit: 50 }]);
});

test('empty general searches still require a query', async () => {
  const service = createSearchService({
    db: {},
    queries: {},
    logger: {},
  });

  await assert.rejects(
    service.search({ userId: 'user-1', query: '', filters: { types: ['posts'] } }),
    /Query is required/
  );
});
