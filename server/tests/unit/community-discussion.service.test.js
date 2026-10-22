import test from 'node:test';
import assert from 'node:assert/strict';

import { createDiscussionService } from '../../src/modules/community/discussion.service.js';

test('community discussions are visible without a workspace and accept members from any account', async () => {
  const calls = [];
  const service = createDiscussionService({
    db: { tx: (callback) => callback({}) },
    queries: {
      listPublicChannels: async () => [{ id: 'channel-id', is_public: true }],
      findChannelById: async () => ({
        id: 'channel-id',
        workspace_id: 'legacy-workspace-id',
        group_id: null,
        is_public: true,
      }),
      insertDiscussionThread: async (_tx, data) => {
        calls.push(data);
        return { id: 'thread-id', ...data };
      },
      findDiscussionThreadById: async () => ({
        id: 'thread-id',
        workspace_id: 'legacy-workspace-id',
        group_id: null,
        is_public: true,
      }),
      listDiscussionThreads: async () => [{ id: 'thread-id', title: 'BTC' }],
    },
    events: { publish: async () => {} },
    realtime: null,
    attachmentService: {},
    logger: {},
  });

  assert.equal((await service.listChannels()).length, 1);
  await service.createThread({ userId: 'second-user', channelId: 'channel-id', title: 'New topic' });
  assert.equal(calls[0].createdBy, 'second-user');
  assert.equal((await service.listThreads({ channelId: 'channel-id' })).length, 1);
});

test('private channels cannot be accessed through community discussions', async () => {
  const service = createDiscussionService({
    db: {},
    queries: {
      findChannelById: async () => ({
        id: 'private-channel',
        group_id: null,
        is_public: false,
      }),
    },
    events: {},
    realtime: null,
    attachmentService: {},
    logger: {},
  });

  await assert.rejects(
    service.listThreads({ channelId: 'private-channel' }),
    /Channel/
  );
});
