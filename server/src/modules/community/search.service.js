/**
 * SyncExc Server — Community search service
 */

import { ValidationError } from '../../lib/errors.js';
import {
  serializeCommunityGroup,
  serializeCommunityProfile,
  serializePost,
} from '../../lib/serializers.js';

export function createSearchService({ db, queries, logger }) {
  async function search({ userId, query, filters = {}, limit = 50 }) {
    if (query !== undefined && typeof query !== 'string') {
      throw new ValidationError('Query must be a string');
    }
    if (query?.length > 200) {
      throw new ValidationError('Query too long');
    }

    const types = filters.types || ['posts', 'profiles', 'groups'];
    const trimmed = query?.trim() ?? '';
    if (!trimmed && !(types.length === 1 && types[0] === 'profiles')) {
      throw new ValidationError('Query is required');
    }

    const results = {};

    if (types.includes('posts')) {
      results.posts = (await queries.searchPosts({ query: trimmed, userId, limit }))
        .map(serializePost);
    }
    if (types.includes('profiles')) {
      results.profiles = (await queries.searchProfiles({ query: trimmed, userId, limit }))
        .map(serializeCommunityProfile);
    }
    if (types.includes('groups')) {
      results.groups = (await queries.searchGroups({ query: trimmed, limit }))
        .map(serializeCommunityGroup);
    }

    const resultCount = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

    // Record search event for analytics
    if (trimmed) {
      try {
        await db.tx(async (tx) => {
          await queries.insertSearchEvent(tx, {
            userId,
            queryText: trimmed,
            resultCount,
            filters,
          });
        });
      } catch (err) {
        logger.warn({ err }, 'Failed to record search event');
      }
    }

    return {
      query: trimmed,
      resultCount,
      results,
    };
  }

  return {
    search,
  };
}

export default createSearchService;