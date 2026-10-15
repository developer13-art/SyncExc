/**
 * SyncExc Server — Signal update tracker
 *
 * Links new messages to existing signals when they represent updates
 * (entry modification, stop-loss change, target change, cancellation).
 */

export function createUpdateTrackerService({ db, queries, logger }) {
  /**
   * Attempt to link a new candidate to a previous one.
   */
  async function findRelatedSignal({ candidateId }) {
    const candidate = await queries.findCandidateById(candidateId);
    if (!candidate) return null;

    // Look for recent signals from the same source, same instrument, not older
    // than 24 hours. This is a naive heuristic — real implementations would
    // use provider reply references or explicit signal IDs.
    const result = await db.query(
      `
      SELECT * FROM trading_signal_candidates
      WHERE source_id = $1
        AND instrument = $2
        AND direction = $3
        AND id <> $4
        AND created_at > now() - interval '24 hours'
        AND status IN ('eligible', 'review_required', 'blocked')
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [candidate.source_id, candidate.instrument, candidate.direction, candidate.id]
    );

    return result.rows[0] || null;
  }

  async function linkUpdate({ candidateId, relatedCandidateId, relationshipType }) {
    return db.tx(async (tx) => {
      const relationship = await queries.insertRelationship(tx, {
        candidateId,
        relatedCandidateId,
        relationshipType,
        confidence: 0.7,
      });
      return relationship;
    });
  }

  return {
    findRelatedSignal,
    linkUpdate,
  };
}

export default createUpdateTrackerService;