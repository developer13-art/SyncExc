import test from 'node:test';
import assert from 'node:assert/strict';

import { createMessagingService } from '../../src/modules/community/messaging.service.js';

function createService(overrides = {}) {
  const events = [];
  const tx = {};
  const conversation = {
    id: 'conversation-1',
    participant_low: 'user-a',
    participant_high: 'user-b',
    created_by: 'user-a',
    state: 'pending',
  };
  const defaults = {
    db: { tx: (callback) => callback(tx) },
    queries: {
      isBlocked: async () => false,
      findProfileByUserId: async () => ({ id: 'profile-b' }),
      getProfilePrivacy: async () => ({ allow_direct_messages: true }),
    },
    messagingQueries: {
      insertConversation: async () => conversation,
      findConversationByPair: async () => conversation,
      insertMessage: async (_client, message) => ({
        id: 'message-1',
        ...message,
        created_at: new Date('2026-01-01T00:00:00Z'),
      }),
      touchConversation: async () => {},
      findConversationForUser: async () => conversation,
      setConversationState: async (_client, id, state) => ({ ...conversation, id, state }),
    },
    events: {
      publish: async (...args) => events.push(args),
    },
  };
  return {
    service: createMessagingService({
      ...defaults,
      ...overrides,
      queries: { ...defaults.queries, ...overrides.queries },
      messagingQueries: { ...defaults.messagingQueries, ...overrides.messagingQueries },
      events: { ...defaults.events, ...overrides.events },
    }),
    events,
    tx,
    conversation,
  };
}

test('starting a DM creates a pending request and notifies only its recipient', async () => {
  const { service, events, tx } = createService();

  const result = await service.startConversation({
    userId: 'user-a',
    recipientId: 'user-b',
    content: 'Hello',
  });

  assert.equal(result.requestPending, true);
  assert.equal(result.message.content, 'Hello');
  assert.equal(events[0][1], 'community.message_request_created');
  assert.equal(events[0][2].userId, 'user-b');
  assert.equal(events[0][3].actorId, 'user-a');
  assert.equal(events[0][0], tx);
});

test('DM requests are rejected when the recipient disables message requests', async () => {
  const { service } = createService({
    queries: {
      getProfilePrivacy: async () => ({ allow_direct_messages: false }),
    },
  });

  await assert.rejects(
    service.startConversation({
      userId: 'user-a',
      recipientId: 'user-b',
      content: 'Hello',
    }),
    /not accepting message requests/
  );
});

test('only the recipient can accept or reject a pending message request', async () => {
  const { service } = createService();

  await assert.rejects(
    service.resolveRequest({
      userId: 'user-a',
      conversationId: 'conversation-1',
      accepted: true,
    }),
    /Only the recipient/
  );

  const result = await service.resolveRequest({
    userId: 'user-b',
    conversationId: 'conversation-1',
    accepted: true,
  });
  assert.equal(result.state, 'active');
});
