/**
 * SyncExc Server — Recommendation service
 *
 * Generates AI-assisted recommendations for people, groups, and discussions.
 * Uses permitted signals only:
 *   - the user's selected interests
 *   - public profile data
 *   - shared public groups and followed topics
 *   - public post activity
 *
 * Never uses private messages, workspace content, exchange balances, or
 * trading history as recommendation signals.
 */

const MIN_CONFIDENCE = 0.4;
const MAX_RECOMMENDATIONS_PER_TYPE = 20;

export function createRecommendationService({ db, queries, ai, searchService, logger }) {
  /**
   * Generate people recommendations for a user.
   */
  async function recommendPeople({ userId }) {
    const profile = await queries.findProfileByUserId(userId);
    if (!profile) return [];

    const interests = profile.interests || [];
    if (interests.length === 0) return [];

    // Find candidate profiles with overlapping interests (public only)
    const candidates = await db.query(
      `
      SELECT p.*, 
        (SELECT count(*) FROM community_follows f WHERE f.followee_id = p.user_id) AS followers_count
      FROM community_profiles p
      WHERE p.user_id <> $1
        AND p.visibility = 'public'
        AND p.interests && $2::text[]
      LIMIT 100
      `,
      [userId, interests]
    );

    // Filter out users already followed or blocked
    const filtered = [];
    for (const candidate of candidates.rows) {
      const isFollowing = await queries.isFollowing(userId, candidate.user_id);
      if (isFollowing) continue;
      const isBlocked = await queries.isBlocked(userId, candidate.user_id);
      if (isBlocked) continue;

      filtered.push(candidate);
    }

    // Rank by number of overlapping interests
    const ranked = filtered
      .map((candidate) => {
        const overlaps = (candidate.interests || []).filter((i) => interests.includes(i));
        return {
          candidate,
          overlapCount: overlaps.length,
          sharedInterests: overlaps,
        };
      })
      .filter((r) => r.overlapCount > 0)
      .sort((a, b) => b.overlapCount - a.overlapCount)
      .slice(0, MAX_RECOMMENDATIONS_PER_TYPE);

    // Generate explanations and persist
    const created = [];
    for (const item of ranked) {
      const explanation = buildExplanation({
        sharedInterests: item.sharedInterests,
        followerCount: item.candidate.followers_count,
      });

      const rec = await db.tx(async (tx) => {
        return queries.insertRecommendation(tx, {
          userId,
          recommendationType: 'people',
          targetRef: { userId: item.candidate.user_id, handle: item.candidate.handle },
          explanation,
          score: item.overlapCount / Math.max(interests.length, 1),
        });
      });

      created.push(rec);
    }

    return created;
  }

  function buildExplanation({ sharedInterests, followerCount }) {
    if (sharedInterests.length > 0) {
      return `You both follow topics in ${sharedInterests.slice(0, 2).join(' and ')}`;
    }
    if (followerCount > 100) {
      return `Popular in the community (${followerCount} followers)`;
    }
    return 'Recommended based on your interests';
  }

  /**
   * Generate group recommendations.
   */
  async function recommendGroups({ userId }) {
    const profile = await queries.findProfileByUserId(userId);
    if (!profile) return [];

    const interests = profile.interests || [];
    if (interests.length === 0) return [];

    // Public groups whose topics overlap with user's interests
    const candidates = await db.query(
      `
      SELECT g.* FROM community_groups g
      WHERE g.type = 'public'
        AND g.owner_id <> $1
        AND EXISTS (
          SELECT 1 FROM unnest($2::text[]) AS interest
          WHERE g.description ILIKE '%' || interest || '%'
             OR g.name ILIKE '%' || interest || '%'
        )
      ORDER BY g.member_count DESC
      LIMIT 50
      `,
      [userId, interests]
    );

    const created = [];
    for (const candidate of candidates.rows) {
      // Skip if already a member
      const membership = await queries.findGroupMembership(candidate.id, userId);
      if (membership && membership.state === 'active') continue;

      const matchedInterest = interests.find(
        (i) =>
          candidate.description?.toLowerCase().includes(i.toLowerCase()) ||
          candidate.name.toLowerCase().includes(i.toLowerCase())
      ) || interests[0];

      const rec = await db.tx(async (tx) => {
        return queries.insertRecommendation(tx, {
          userId,
          recommendationType: 'groups',
          targetRef: { groupId: candidate.id, name: candidate.name, slug: candidate.slug },
          explanation: `Discusses ${matchedInterest} — matches your interests`,
          score: 0.7,
        });
      });

      created.push(rec);
    }

    return created.slice(0, MAX_RECOMMENDATIONS_PER_TYPE);
  }

  async function listRecommendations({ userId, type, limit }) {
    return queries.listActiveRecommendations(userId, { type, limit });
  }

  async function submitFeedback({ userId, recommendationId, feedback }) {
    const validFeedback = ['dismissed', 'helpful', 'not_helpful', 'reported'];
    if (!validFeedback.includes(feedback)) {
      throw new Error(`Invalid feedback: ${feedback}`);
    }

    return db.tx(async (tx) => {
      return queries.insertRecommendationFeedback(tx, {
        recommendationId,
        userId,
        feedback,
      });
    });
  }

  async function refreshRecommendations({ userId }) {
    const people = await recommendPeople({ userId });
    const groups = await recommendGroups({ userId });
    return {
      people: people.length,
      groups: groups.length,
    };
  }

  return {
    recommendPeople,
    recommendGroups,
    listRecommendations,
    submitFeedback,
    refreshRecommendations,
  };
}

export default createRecommendationService;