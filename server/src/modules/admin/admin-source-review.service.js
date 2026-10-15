/**
 * SyncExc Server — Admin source discovery review
 */

import { NotFoundError, ValidationError } from '../../lib/errors.js';

export function createAdminSourceReviewService({ db, queries, sources, events, audit, logger }) {
  async function listCandidates({ status, search, limit = 100, offset } = {}) {
    const params = [limit];
    const conditions = [];
    if (status) {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(c.name ILIKE $${params.length} OR c.url ILIKE $${params.length} OR c.identifier ILIKE $${params.length})`
      );
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `
      SELECT c.*, w.name AS workspace_name, COUNT(*) OVER () AS total_count
      FROM signal_source_candidates c
      JOIN workspaces w ON w.id = c.workspace_id
      ${whereClause}
      ORDER BY c.confidence_score DESC NULLS LAST, c.discovered_at DESC
      LIMIT $1
      ${offset === undefined ? '' : `OFFSET $${params.push(offset)}`}
      `,
      params
    );
    const total = Number(result.rows[0]?.total_count ?? 0);
    const rows = result.rows.map(({ total_count: _totalCount, ...row }) => row);
    return { rows, total };
  }

  async function getCandidate({ candidateId, actorId }) {
    const candidate = await db.query(
      `SELECT * FROM signal_source_candidates WHERE id = $1`,
      [candidateId]
    );
    if (candidate.rows.length === 0) throw new NotFoundError('Candidate');

    const evidence = await db.query(
      `SELECT * FROM signal_source_discovery_evidence WHERE candidate_id = $1`,
      [candidateId]
    );

    const reviews = await db.query(
      `
      SELECT r.*, u.email AS reviewer_email
      FROM signal_source_reviews r
      LEFT JOIN users u ON u.id = r.reviewer_id
      WHERE r.candidate_id = $1
      ORDER BY r.created_at DESC
      `,
      [candidateId]
    );

    await audit.write({
      actorId,
      action: 'source_candidate.viewed',
      targetResource: 'source_candidate',
      targetId: candidateId,
    });

    return {
      candidate: candidate.rows[0],
      evidence: evidence.rows,
      reviews: reviews.rows,
    };
  }

  async function decide({ candidateId, reviewerId, decision, reason, scope }) {
    if (!['approve', 'reject', 'request_information', 'suspend'].includes(decision)) {
      throw new ValidationError(`Invalid decision: ${decision}`);
    }
    if (!reason || reason.length < 10) {
      throw new ValidationError('A reason of at least 10 characters is required');
    }

    return sources.review.submitDecision({
      reviewerId,
      workspaceId: null,
      targetType: 'candidate',
      targetId: candidateId,
      decision,
      scope,
      reason,
    }).then((review) => {
      return audit.write({
        actorId: reviewerId,
        action: `source_candidate.${decision}`,
        targetResource: 'source_candidate',
        targetId: candidateId,
        reason,
        after: { decision, scope },
      }).then(() => review);
    });
  }

  return {
    listCandidates,
    getCandidate,
    decide,
  };
}

export default createAdminSourceReviewService;