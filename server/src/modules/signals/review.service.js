/**
 * SyncExc Server — Signal review service
 */

import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';

export function createReviewService({ db, queries, events, logger }) {
  async function submitReview({
    candidateId,
    reviewerId,
    decision,
    corrections,
    reason,
  }) {
    if (!['confirm', 'correct', 'reject', 'link_update', 'request_more_info'].includes(decision)) {
      throw new ValidationError(`Invalid review decision: ${decision}`);
    }
    if (!reason || reason.length < 10) {
      throw new ValidationError('A reason of at least 10 characters is required');
    }

    const candidate = await queries.findCandidateById(candidateId);
    if (!candidate) throw new NotFoundError('Candidate');

    return db.tx(async (tx) => {
      // Insert the review
      const review = await queries.insertReview(tx, {
        candidateId,
        reviewerId,
        decision,
        corrections,
        reason,
      });

      // Apply corrections if provided
      if (corrections && typeof corrections === 'object') {
        for (const [field, afterValue] of Object.entries(corrections)) {
          const beforeValue = candidate[field];
          if (beforeValue !== afterValue) {
            await queries.insertCorrection(tx, {
              candidateId,
              reviewerId,
              fieldName: field,
              beforeValue,
              afterValue,
              reason: 'reviewer_correction',
            });
          }
        }
      }

      // Update candidate status
      let newStatus = candidate.status;
      if (decision === 'confirm' || decision === 'correct') {
        newStatus = 'validating';
      } else if (decision === 'reject') {
        newStatus = 'rejected';
      } else if (decision === 'request_more_info') {
        newStatus = 'review_required';
      }

      // Merge corrections into the candidate
      if (corrections) {
        await queries.updateCandidate(candidateId, {
          instrument: corrections.instrument,
          direction: corrections.direction,
          entry: corrections.entry,
          entryRange: corrections.entryRange,
          stopLoss: corrections.stopLoss,
          leverage: corrections.leverage,
          marketType: corrections.marketType,
          status: newStatus,
        });
      } else {
        await queries.updateCandidate(candidateId, { status: newStatus });
      }

      // Audit
      await queries.insertAuditEvent(tx, {
        actorId: reviewerId,
        action: `signal.review.${decision}`,
        resourceType: 'signal_candidate',
        resourceId: candidateId,
        after: { decision, corrections },
      });

      // Emit
      await events.publish(
        tx,
        decision === 'reject' ? 'signal.blocked' : 'signal.review_required',
        { candidateId, decision, reason },
        {
          actorId: reviewerId,
          resourceType: 'signal_candidate',
          resourceId: candidateId,
        }
      );

      return review;
    });
  }

  return {
    submitReview,
  };
}

export default createReviewService;