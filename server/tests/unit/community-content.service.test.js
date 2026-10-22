import test from 'node:test';
import assert from 'node:assert/strict';

import { createCommunityContentService } from '../../src/modules/community/content.service.js';

function createService({ poll = {}, event = {}, overrides = {} } = {}) {
  const calls = { votes: [], rsvps: [] };
  const tx = {};
  const defaults = {
    db: { tx: (callback) => callback(tx) },
    postService: {
      getPost: async () => ({ post: { poll, event } }),
    },
    queries: {
      lockPoll: async () => ({
        post_id: 'post-1',
        allow_multiple: false,
        closes_at: null,
      }),
      listPollOptionIds: async (_postId, ids) => ids,
      replacePollVotes: async (...args) => calls.votes.push(args),
      lockEvent: async () => ({ post_id: 'post-1', capacity: 1 }),
      findEventRsvp: async () => null,
      countGoingRsvps: async () => 1,
      upsertEventRsvp: async (...args) => calls.rsvps.push(args),
    },
  };
  return {
    service: createCommunityContentService({
      ...defaults,
      ...overrides,
      queries: { ...defaults.queries, ...overrides.queries },
    }),
    calls,
    tx,
  };
}

test('poll voting replaces the user vote only for options belonging to the poll', async () => {
  const { service, calls, tx } = createService();

  await service.votePoll({
    userId: 'user-1',
    postId: 'post-1',
    optionIds: ['option-1'],
  });

  assert.deepEqual(calls.votes, [[tx, 'post-1', 'user-1', ['option-1']]]);
});

test('single-choice poll rejects multiple selections', async () => {
  const { service } = createService();

  await assert.rejects(
    service.votePoll({
      userId: 'user-1',
      postId: 'post-1',
      optionIds: ['option-1', 'option-2'],
    }),
    /allows one choice/
  );
});

test('event RSVP enforces capacity before adding a new attendee', async () => {
  const { service, calls } = createService();

  await assert.rejects(
    service.updateEventRsvp({
      userId: 'user-1',
      postId: 'post-1',
      status: 'going',
    }),
    /at capacity/
  );
  assert.equal(calls.rsvps.length, 0);
});
