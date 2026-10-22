import test from 'node:test';
import assert from 'node:assert/strict';

import { createProfileService } from '../../src/modules/community/profile.service.js';

test('viewing an existing user without a Community profile provisions one', async () => {
  let profile = null;
  const versions = [];
  let privacyCreated = false;
  const service = createProfileService({
    db: {
      query: async () => ({
        rows: [{ username: 'legacy_member', display_name: 'Legacy Member', avatar_url: null }],
      }),
      tx: async (callback) => callback({}),
    },
    queries: {
      findProfileByUserId: async () => profile,
      findProfileByHandle: async () => null,
      insertProfile: async (_tx, data) => {
        profile = {
          id: 'profile-id',
          user_id: data.userId,
          handle: data.handle,
          display_name: data.displayName,
          visibility: 'public',
        };
        return profile;
      },
      insertProfileVersion: async (_tx, data) => versions.push(data),
      upsertProfilePrivacy: async () => {
        privacyCreated = true;
      },
      getProfilePrivacy: async () => ({ allow_direct_messages: true }),
      hasPendingFollowRequest: async () => false,
      countFollowers: async () => 0,
      countFollowing: async () => 0,
    },
    events: {},
    logger: {},
  });

  const result = await service.getProfileWithPrivacy({
    userId: 'legacy-user-id',
    viewerId: 'legacy-user-id',
  });

  assert.equal(result.profile.handle, 'legacy_member');
  assert.equal(result.profile.display_name, 'Legacy Member');
  assert.equal(result.isOwner, true);
  assert.equal(versions.length, 1);
  assert.equal(privacyCreated, true);
});
