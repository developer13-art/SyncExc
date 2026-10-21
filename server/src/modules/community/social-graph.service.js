/**
 * SyncExc Server — Social graph service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createSocialGraphService({ db, queries, events, logger }) {
  async function follow({ followerId, followeeId }) {
    if (followerId === followeeId) {
      throw new ConflictError('Cannot follow yourself', 'SELF_FOLLOW');
    }

    // Check for block
    const blocked = await queries.isBlocked(followeeId, followerId);
    if (blocked) throw new ConflictError('Unable to follow', 'FOLLOW_BLOCKED');
    const blockedMe = await queries.isBlocked(followerId, followeeId);
    if (blockedMe) throw new ConflictError('Unable to follow', 'FOLLOW_BLOCKED');

    // Check followee's privacy
    const followeeProfile = await queries.findProfileByUserId(followeeId);
    if (!followeeProfile) throw new NotFoundError('Profile');
    const privacy = await queries.getProfilePrivacy(followeeProfile.id);
    if (privacy && privacy.allow_follows === false) {
      throw new ConflictError('User does not allow follows', 'FOLLOWS_DISABLED');
    }

    if (await queries.isFollowing(followerId, followeeId)) {
      return { alreadyFollowing: true };
    }

    if (['followers', 'private'].includes(followeeProfile.visibility)) {
      if (await queries.hasPendingFollowRequest(followerId, followeeId)) {
        return { alreadyRequested: true };
      }
      return db.tx(async (tx) => {
        const request = await queries.insertFollowRequest(tx, { followerId, followeeId });
        if (!request) return { alreadyRequested: true };
        await events.publish(
          tx,
          'community.follow_request_created',
          { followerId, followeeId },
          {
            actorId: followerId,
            resourceType: 'community_follow_request',
            resourceId: request.id,
          }
        );
        return request;
      });
    }
    if (['group_members', 'workspace_members'].includes(followeeProfile.visibility)) {
      throw new ConflictError('This profile is not available for public follows', 'FOLLOW_CONTEXT_REQUIRED');
    }

    return db.tx(async (tx) => {
      await queries.insertFollow(tx, { followerId, followeeId });
      if (!follow) return { alreadyFollowing: true };

      await events.publish(
        tx,
        'community.follow_created',
        { followerId, followeeId },
        {
          actorId: followerId,
          resourceType: 'community_follow',
          resourceId: follow.id,
        }
      );

      return follow;
    });
  }

  async function unfollow({ followerId, followeeId }) {
    const ok = await queries.removeFollow(followerId, followeeId);
    return { ok };
  }

  async function listFollowers(userId, { limit }) {
    return queries.listFollowers(userId, { limit });
  }

  async function listFollowing(userId, { limit }) {
    return queries.listFollowing(userId, { limit });
  }

  async function block({ blockerId, blockedId }) {
    if (blockerId === blockedId) {
      throw new ConflictError('Cannot block yourself', 'SELF_BLOCK');
    }

    return db.tx(async (tx) => {
      const blockRecord = await queries.insertBlock(tx, { blockerId, blockedId });
      if (!blockRecord) return { alreadyBlocked: true };

      // Remove existing follows in both directions
      await queries.removeFollow(blockerId, blockedId);
      await queries.removeFollow(blockedId, blockerId);

      return blockRecord;
    });
  }

  async function unblock({ blockerId, blockedId }) {
    const ok = await queries.removeBlock(blockerId, blockedId);
    return { ok };
  }

  async function listBlocks(userId) {
    return queries.listBlocks(userId);
  }

  async function listFollowRequests(userId) {
    return queries.listFollowRequests(userId, {});
  }

  async function resolveFollowRequest({ followeeId, followerId, approved }) {
    return db.tx(async (tx) => {
      const request = await queries.resolveFollowRequest(tx, {
        followerId,
        followeeId,
        state: approved ? 'accepted' : 'declined',
      });
      if (!request) throw new NotFoundError('Follow request');

      if (!approved) return request;
      const follow = await queries.insertFollow(tx, { followerId, followeeId });
      await events.publish(
        tx,
        'community.follow_request_accepted',
        { followerId, followeeId },
        {
          actorId: followeeId,
          resourceType: 'community_follow_request',
          resourceId: request.id,
        }
      );
      return { ...request, follow };
    });
  }

  return {
    follow,
    unfollow,
    listFollowers,
    listFollowing,
    block,
    unblock,
    listBlocks,
    listFollowRequests,
    resolveFollowRequest,
  };
}

export default createSocialGraphService;