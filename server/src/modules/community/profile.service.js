/**
 * SyncExc Server — Community profile service
 */

import { NotFoundError, ConflictError, AuthorizationError } from '../../lib/errors.js';

export function createProfileService({ db, queries, events, logger }) {
  async function ensureProfileForUser(userId, { displayName, handle } = {}) {
    const existing = await queries.findProfileByUserId(userId);
    if (existing) return existing;

    // Derive a handle from the user's email if not provided
    const userResult = await db.query(
      `SELECT username, display_name, avatar_url FROM users WHERE id = $1`,
      [userId]
    );
    const user = userResult.rows[0];
    if (!user) throw new NotFoundError('User');

    const candidateHandle = handle || user.username;
    const resolvedHandle = await ensureUniqueHandle(candidateHandle);

    return db.tx(async (tx) => {
      const profile = await queries.insertProfile(tx, {
        userId,
        handle: resolvedHandle,
        displayName: displayName || user.display_name,
        avatarUrl: user.avatar_url,
      });

      await queries.insertProfileVersion(tx, {
        profileId: profile.id,
        version: 1,
        snapshot: profile,
      });

      await queries.upsertProfilePrivacy(tx, {
        profileId: profile.id,
      });

      return profile;
    });
  }

  async function ensureUniqueHandle(baseHandle) {
    const normalized = String(baseHandle).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30);
    let candidate = normalized;
    let suffix = 1;
    while (true) {
      const existing = await queries.findProfileByHandle(candidate);
      if (!existing) return candidate;
      candidate = `${normalized}_${suffix}`.slice(0, 32);
      suffix += 1;
      if (suffix > 1000) throw new ConflictError('Unable to allocate handle');
    }
  }

  async function getProfileByUserId(userId) {
    return queries.findProfileByUserId(userId);
  }

  async function getProfileByHandle(handle) {
    return queries.findProfileByHandle(handle);
  }

  async function getProfileWithPrivacy({ userId, viewerId = null }) {
    const profile = await queries.findProfileByUserId(userId);
    if (!profile) throw new NotFoundError('Profile');
    const privacy = await queries.getProfilePrivacy(profile.id);

    const isOwner = viewerId === userId;
    let isFollowing = false;
    let isBlocked = false;
    if (viewerId && !isOwner) {
      isBlocked =
        (await queries.isBlocked(viewerId, userId)) ||
        (await queries.isBlocked(userId, viewerId));
      if (isBlocked) throw new AuthorizationError('Profile is not available');
      isFollowing = await queries.isFollowing(viewerId, userId);
    }

    if (
      !isOwner &&
      ['group_members', 'workspace_members'].includes(profile.visibility)
    ) {
      throw new AuthorizationError('Profile is not available');
    }

    const viewerHasPendingFollowRequest = viewerId
      ? await queries.hasPendingFollowRequest(viewerId, userId)
      : false;
    const canSeeFullProfile =
      isOwner || profile.visibility === 'public' || isFollowing;
    const visibleProfile = canSeeFullProfile
      ? profile
      : {
          ...profile,
          biography: null,
          long_introduction: null,
          interests: [],
          skills: [],
          website: null,
        };
    const followersCount = await queries.countFollowers(userId);
    const followingCount = await queries.countFollowing(userId);

    return {
      profile: visibleProfile,
      privacy,
      followersCount,
      followingCount,
      isFollowing,
      isBlocked,
      viewerHasPendingFollowRequest,
    };
  }

  async function updateProfile({ userId, updates }) {
    const profile = await queries.findProfileByUserId(userId);
    if (!profile) throw new NotFoundError('Profile');

    if (updates.handle && updates.handle !== profile.handle) {
      const existing = await queries.findProfileByHandle(updates.handle);
      if (existing && existing.user_id !== userId) {
        throw new ConflictError('Handle is already taken', 'HANDLE_TAKEN');
      }
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateProfile(profile.id, updates, tx);

      await queries.insertProfileVersion(tx, {
        profileId: profile.id,
        version: profile.current_version + 1,
        snapshot: updated,
      });

      await events.publish(
        tx,
        'community.profile_updated',
        { profileId: profile.id, userId },
        {
          actorId: userId,
          resourceType: 'community_profile',
          resourceId: profile.id,
        }
      );

      return updated;
    });
  }

  async function updatePrivacy({ userId, updates }) {
    const profile = await queries.findProfileByUserId(userId);
    if (!profile) throw new NotFoundError('Profile');

    return db.tx(async (tx) => {
      return queries.upsertProfilePrivacy(tx, {
        profileId: profile.id,
        allowFollows: updates.allowFollows,
        allowMentions: updates.allowMentions,
        allowDirectMessages: updates.allowDirectMessages,
        allowRecommendations: updates.allowRecommendations,
      });
    });
  }

  return {
    ensureProfileForUser,
    getProfileByUserId,
    getProfileByHandle,
    getProfileWithPrivacy,
    updateProfile,
    updatePrivacy,
  };
}

export default createProfileService;