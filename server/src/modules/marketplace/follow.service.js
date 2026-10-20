/**
 * SyncExc Server — Follow service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createFollowService({ db, queries, events, logger }) {
  async function follow({ userId, providerId }) {
    const provider = await queries.findProviderById(providerId);
    if (!provider) throw new NotFoundError('Provider');
    if (provider.moderation_state === 'suspended') {
      throw new ConflictError('Provider is suspended', 'PROVIDER_SUSPENDED');
    }

    return db.tx(async (tx) => {
      const follow = await queries.insertFollow(tx, {
        providerId,
        followerUserId: userId,
      });

      if (!follow) {
        // Already following — no-op
        return { alreadyFollowing: true };
      }

      await events.publish(
        tx,
        'marketplace.follow_created',
        { providerId, userId },
        {
          actorId: userId,
          resourceType: 'marketplace_follow',
          resourceId: follow.id,
        }
      );

      return follow;
    });
  }

  async function unfollow({ userId, providerId }) {
    const ok = await queries.removeFollow(providerId, userId);
    if (!ok) throw new NotFoundError('Follow');
    return { ok: true };
  }

  async function listFollowing({ userId }) {
    return queries.listFollowsForUser(userId);
  }

  async function countFollowers(providerId) {
    return queries.countFollowers(providerId);
  }

  async function isFollowing({ userId, providerId }) {
    if (!userId) return false;
    return queries.isFollowing(providerId, userId);
  }

  return {
    follow,
    unfollow,
    listFollowing,
    countFollowers,
    isFollowing,
  };
}

export default createFollowService;