import test from 'node:test';
import assert from 'node:assert/strict';

import { createPostService } from '../../src/modules/community/ost.service.js';

test('new uploaded post attachments are associated without legacy attachments', async () => {
  const calls = [];
  const service = createPostService({
    db: { tx: (callback) => callback({}) },
    queries: {
      insertPost: async () => ({ id: 'post-id' }),
      insertPostVersion: async () => {},
    },
    events: { publish: async () => {} },
    realtime: null,
    attachmentService: {
      attach: async (_tx, data) => calls.push(data),
    },
    logger: {},
  });

  await service.createPost({
    userId: 'user-id',
    destinationType: 'public_feed',
    content: '',
    attachmentIds: ['attachment-id'],
  });

  assert.deepEqual(calls, [{
    userId: 'user-id',
    attachmentIds: ['attachment-id'],
    resourceType: 'post',
    resourceId: 'post-id',
  }]);
});
