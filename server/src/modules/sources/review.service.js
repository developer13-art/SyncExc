/**
 * SyncExc Server — Source review service
 */

import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';

export function createReviewService({ db, queries, events, logger }) {
  /**
   * Submit a review decision for a candidate or an existing source.
   */
  async function submitDecision({
    reviewerId,
    workspaceId,
    targetType, // 'source' | 'candidate'
    targetId,
    decision,   // 'approve' | 'reject' | 'request_information' | 'suspend'
    scope,
    reason,
  }) {
    if (!['approve', 'reject', 'request_information', 'suspend'].includes(decision)) {
      throw new ValidationError(`Invalid decision: ${decision}`);
    }
    if (!reason || reason.length < 10) {
      throw new ValidationError('A reason of at least 10 characters is required');
    }

    let target;
    if (targetType === 'source') {
      target = await queries.findSourceById(targetId);
      if (!target || target.workspace_id !== workspaceId) throw new NotFoundError('Source');
    } else if (targetType === 'candidate') {
      target = await queries.findCandidateById(targetId);
      if (!target || target.workspace_id !== workspaceId) throw new NotFoundError('Candidate');
    } else {
      throw new ValidationError('targetType must be "source" or "candidate"');
    }

    return db.tx(async (tx) => {
      const review = await queries.insertReview(tx, {
        sourceId: targetType === 'source' ? targetId : null,
        candidateId: targetType === 'candidate' ? targetId : null,
        reviewerId,
        decision,
        scope,
        reason,
      });

      // Transition the target
      if (targetType === 'candidate') {
        const newStatus = mapCandidateStatus(decision);
        await queries.updateCandidateStatus(targetId, newStatus, new Date());
      } else {
        const newStatus = mapSourceStatus(decision, target.status);
        await queries.updateSourceStatus(targetId, newStatus);
      }

      // Audit
      await queries.insertAuditEvent(tx, {
        sourceId: targetType === 'source' ? targetId : null,
        actorId: reviewerId,
        action: `source.review.${decision}`,
        resourceType: targetType,
        resourceId: targetId,
        after: { decision, scope, reason },
      });

      // Emit
      await events.publish(
        tx,
        decision === 'approve' ? 'source.approved' : 'source.rejected',
        { targetType, targetId, scope, reason },
        {
          actorId: reviewerId,
          workspaceId,
          resourceType: targetType,
          resourceId: targetId,
        }
      );

      return review;
    });
  }

  function mapCandidateStatus(decision) {
    switch (decision) {
      case 'approve':
        return 'approved_for_validation';
      case 'reject':
        return 'rejected';
      case 'request_information':
        return 'additional_information_required';
      case 'suspend':
        return 'suspended';
      default:
        return 'pending_review';
    }
  }

  function mapSourceStatus(decision, current) {
    switch (decision) {
      case 'approve':
        return 'approved';
      case 'reject':
        return 'rejected';
      case 'request_information':
        return 'pending_validation';
      case 'suspend':
        return 'suspended';
      default:
        return current;
    }
  }

  async function listReviewsForSource({ sourceId, workspaceId }) {
    const source = await queries.findSourceById(sourceId);
    if (!source || source.workspace_id !== workspaceId) throw new NotFoundError('Source');
    return queries.listReviewsForSource(sourceId);
  }

  async function listReviewsForCandidate({ candidateId, workspaceId }) {
    const candidate = await queries.findCandidateById(candidateId);
    if (!candidate || candidate.workspace_id !== workspaceId) throw new NotFoundError('Candidate');
    return queries.listReviewsForCandidate(candidateId);
  }

  return {
    submitDecision,
    listReviewsForSource,
    listReviewsForCandidate,
  };
}

export default createReviewService;