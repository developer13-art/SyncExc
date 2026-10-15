/**
 * SyncExc Server — Reaction service
 */

import { NotFoundError } from '../../lib/errors.js';

const VALID_REACTIONS = ['like', 'love', 'insightful', 'bullish', 'bearish'];

export function createReactionService({ db, queries, logger }) {
  async function addReaction({ userId, targetType, targetId, reactionType }) {
    if (!VALID_REACTIONS.includes(reactionType)) {
      throw new Error(`Invalid reaction: ${reactionType}`);
    }

    return db.tx(async (tx) => {
      return queries.upsertReaction(tx, {
        userId,
        targetType,
        targetId,
        reactionType,
      });
    });
  }

  async function removeReaction({ userId, targetType, targetId }) {
    const ok = await queries.deleteReaction(userId, targetType, targetId);
    return { ok };
  }

  async function countReactions({ targetType, targetId }) {
    const count = await queries.countReactions(targetType, targetId);
    return { count };
  }

  return {
    addReaction,
    removeReaction,
    countReactions,
  };
}

export default createReactionService;