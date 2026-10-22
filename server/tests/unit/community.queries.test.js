import test from 'node:test';
import assert from 'node:assert/strict';

import { createCommunityQueries } from '../../src/modules/community/community.queries.js';

function createQueryRecorder() {
  const calls = [];
  return {
    calls,
    queries: createCommunityQueries({
      db: {
        query: async (sql, params = []) => {
          calls.push({ sql, params });
          return { rows: [] };
        },
      },
    }),
  };
}

test('profile discovery binds only the parameters used by its SQL', async () => {
  const { calls, queries } = createQueryRecorder();

  await queries.searchProfiles({ query: '', userId: 'viewer-id', limit: 50 });

  assert.deepEqual(calls[0].params, ['viewer-id', '', 50]);
  assert.match(calls[0].sql, /u\.id <> \$1/);
  assert.match(calls[0].sql, /\$2 = ''/);
  assert.match(calls[0].sql, /LIMIT \$3/);
  assert.doesNotMatch(calls[0].sql, /\$4/);
});

test('public feed includes users without Community profiles while enforcing profile visibility', async () => {
  const { calls, queries } = createQueryRecorder();

  await queries.listFeedPosts({ userId: 'viewer-id', followingOnly: false });

  assert.match(calls[0].sql, /LEFT JOIN community_profiles prof/);
  assert.match(calls[0].sql, /COALESCE\(prof\.handle, u\.username_normalized, u\.username\)/);
  assert.match(calls[0].sql, /COALESCE\(prof\.visibility, 'public'\) = 'public'/);
  assert.match(calls[0].sql, /NOT EXISTS \([\s\S]*community_blocks/);
  assert.equal(
    [...calls[0].sql].filter((character) => character === '(').length,
    [...calls[0].sql].filter((character) => character === ')').length
  );
});

test('following feed includes the viewer’s own posts', async () => {
  const { calls, queries } = createQueryRecorder();

  await queries.listFeedPosts({ userId: 'viewer-id', followingOnly: true });

  assert.match(calls[0].sql, /p\.author_id = \$3 OR p\.visibility = 'public'/);
  assert.match(calls[0].sql, /p\.author_id = \$2/);
  assert.equal(
    [...calls[0].sql].filter((character) => character === '(').length,
    [...calls[0].sql].filter((character) => character === ')').length
  );
});

test('group post listing does not let membership bypass post or profile visibility', async () => {
  const { calls, queries } = createQueryRecorder();

  await queries.listGroupPosts({
    groupId: 'group-id',
    viewerId: 'viewer-id',
    allowPublic: true,
  });

  assert.match(calls[0].sql, /LEFT JOIN community_profiles prof/);
  assert.match(calls[0].sql, /COALESCE\(prof\.visibility, 'public'\)/);
  assert.match(calls[0].sql, /p\.visibility IN \('public', 'group_members'\)/);
  assert.match(calls[0].sql, /community_follows/);
});

test('discussion topics and messages retain authors without Community profiles', async () => {
  const { calls, queries } = createQueryRecorder();

  await queries.listDiscussionThreads('channel-id');
  await queries.listDiscussionMessages('thread-id');

  assert.equal(calls.length, 2);
  for (const { sql } of calls) {
    assert.match(sql, /JOIN users u/);
    assert.match(sql, /LEFT JOIN community_profiles/);
    assert.match(sql, /COALESCE\(/);
  }
});

test('discussion channels are listed globally and channel inserts are marked public', async () => {
  const calls = [];
  const client = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return { rows: [{ id: 'channel-id', is_public: true }] };
    },
  };
  const queries = createCommunityQueries({ db: client });

  await queries.listPublicChannels();
  await queries.insertChannel(client, {
    name: 'general',
    kind: 'general',
    isPublic: true,
  });

  assert.match(calls[0].sql, /is_public = true/);
  assert.match(calls[1].sql, /INSERT INTO community_channels .*is_public/s);
  assert.equal(calls[1].params[4], true);
});

test('group inserts and updates persist topics and branding fields', async () => {
  const { calls, queries } = createQueryRecorder();
  const client = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };

  await queries.insertGroup(client, {
    ownerId: 'owner-id',
    name: 'Trading',
    slug: 'trading',
    type: 'public',
    visibility: 'public',
    topics: ['crypto'],
  });
  await queries.updateGroup('group-id', {
    topics: ['crypto', 'analysis'],
    avatarUrl: 'https://example.com/avatar.png',
    coverImageUrl: 'https://example.com/cover.png',
  });

  assert.match(calls[0].sql, /visibility, topics/);
  assert.deepEqual(calls[0].params[7], ['crypto']);
  assert.match(calls[1].sql, /topics = COALESCE\(\$6, topics\)/);
  assert.match(calls[1].sql, /avatar_url = COALESCE\(\$7, avatar_url\)/);
  assert.match(calls[1].sql, /cover_image_url = COALESCE\(\$8, cover_image_url\)/);
  assert.deepEqual(calls[1].params.slice(5), [
    ['crypto', 'analysis'],
    'https://example.com/avatar.png',
    'https://example.com/cover.png',
  ]);
});
