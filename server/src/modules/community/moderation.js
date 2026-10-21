/**
 * SyncExc Server — Community moderation service
 */

import { NotFoundError, ConflictError, AuthorizationError } from '../../lib/errors.js';

const VALID_ACTIONS = ['dismiss', 'remove_content', 'add_warning', 'refer_to_admin'];

export function createModerationService({ db, queries, events, logger }) {
  async function findResourceOwner(resourceType, resourceId) {
    const resources = {
      post: 'SELECT author_id AS owner_id FROM community_posts WHERE id = $1',
      comment: 'SELECT author_id AS owner_id FROM community_comments WHERE id = $1',
      profile: 'SELECT user_id AS owner_id FROM community_profiles WHERE id = $1',
      group: 'SELECT owner_id FROM community_groups WHERE id = $1',
      analysis: 'SELECT author_id AS owner_id FROM community_analysis_documents WHERE id = $1',
    };
    const query = resources[resourceType];
    if (!query) throw new ConflictError('Unsupported report resource');
    const result = await db.query(query, [resourceId]);
    return result.rows[0]?.owner_id || null;
  }

  async function submitReport({ userId, resourceType, resourceId, reason, details }) {
    const ownerId = await findResourceOwner(resourceType, resourceId);
    if (!ownerId) throw new NotFoundError('Reported content');

    return db.tx(async (tx) => {
      const moderationCase = await queries.insertModerationCase(tx, {
        reporterId: userId,
        resourceType,
        resourceId,
        reason,
        details,
      });

      await events.publish(
        tx,
        'community.report_submitted',
        { caseId: moderationCase.id, resourceType, resourceId, reason },
        {
          actorId: userId,
          resourceType: 'community_moderation_case',
          resourceId: moderationCase.id,
        }
      );

      return moderationCase;
    });
  }

  async function decide({ caseId, actorId, action, reason, notes }) {
    if (!VALID_ACTIONS.includes(action)) {
      throw new ConflictError(`Invalid moderation action: ${action}`);
    }

    const moderationCase = await queries.findModerationCaseById(caseId);
    if (!moderationCase) throw new NotFoundError('Case');
    if (
      action === 'remove_content' &&
      !['post', 'comment'].includes(moderationCase.resource_type)
    ) {
      throw new ConflictError('This action is only available for posts and comments');
    }

    const newState = action === 'dismiss'
      ? 'dismissed'
      : action === 'refer_to_admin'
      ? 'escalated'
      : 'resolved';

    return db.tx(async (tx) => {
      const updated = await queries.updateModerationCase(caseId, {
        state: newState,
        resolvedAt: newState === 'escalated' ? null : new Date(),
      }, tx, ['pending', 'under_review', 'escalated']);
      if (!updated) {
        throw new ConflictError('This moderation case has already been decided');
      }

      await queries.insertModerationAction(tx, {
        caseId,
        actorId,
        action,
        reason,
      });

      // Apply the action
      if (action === 'remove_content') {
        if (moderationCase.resource_type === 'post') {
          await tx.query(
            `UPDATE community_posts SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
            [moderationCase.resource_id]
          );
        } else if (moderationCase.resource_type === 'comment') {
          const deleted = await tx.query(
            `UPDATE community_comments SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING post_id`,
            [moderationCase.resource_id]
          );
          if (deleted.rowCount > 0) {
            await queries.adjustPostCommentCount(deleted.rows[0].post_id, -1, tx);
          }
        }
      }

      await queries.insertAuditEvent(tx, {
        actorId,
        action: `moderation.${action}`,
        resourceType: moderationCase.resource_type,
        resourceId: moderationCase.resource_id,
        before: { caseState: moderationCase.state },
        after: { caseState: newState, reason, notes: notes || null },
      });

      await events.publish(
        tx,
        'community.moderation_action',
        {
          caseId,
          action,
          resourceType: moderationCase.resource_type,
          resourceId: moderationCase.resource_id,
        },
        {
          actorId,
          resourceType: 'community_moderation_case',
          resourceId: caseId,
        }
      );

      return updated;
    });
  }

  async function submitAppeal({ userId, caseId, reason }) {
    const moderationCase = await queries.findModerationCaseById(caseId);
    if (!moderationCase) throw new NotFoundError('Case');
    if (!['resolved', 'dismissed'].includes(moderationCase.state)) {
      throw new ConflictError('Only resolved moderation cases can be appealed');
    }
    const ownerId = await findResourceOwner(
      moderationCase.resource_type,
      moderationCase.resource_id
    );
    if (ownerId !== userId) {
      throw new AuthorizationError('Only the affected content owner can appeal');
    }
    const pendingAppeal = await queries.findPendingModerationAppeal(caseId, userId);
    if (pendingAppeal) throw new ConflictError('An appeal is already pending');

    return db.tx(async (tx) => {
      const appeal = await queries.insertModerationAppeal(tx, {
        caseId,
        appellantId: userId,
        reason,
      });
      if (!appeal) throw new ConflictError('An appeal is already pending');
      await queries.insertAuditEvent(tx, {
        actorId: userId,
        action: 'moderation.appeal_submitted',
        resourceType: 'moderation_appeal',
        resourceId: appeal.id,
        after: { caseId, status: 'pending' },
      });
      return appeal;
    });
  }

  async function decideAppeal({ appealId, actorId, status, resolution }) {
    if (!['upheld', 'overturned', 'dismissed'].includes(status)) {
      throw new ConflictError(`Invalid appeal decision: ${status}`);
    }
    const appeal = await queries.findModerationAppealById(appealId);
    if (!appeal) throw new NotFoundError('Appeal');
    const moderationCase = await queries.findModerationCaseById(appeal.case_id);
    if (!moderationCase) throw new NotFoundError('Case');

    return db.tx(async (tx) => {
      const updatedAppeal = await queries.updateModerationAppeal(
        appealId,
        { status, resolution },
        tx
      );
      if (!updatedAppeal) throw new ConflictError('This appeal has already been decided');

      if (status === 'overturned') {
        if (moderationCase.resource_type === 'post') {
          await tx.query(
            `UPDATE community_posts SET deleted_at = NULL WHERE id = $1`,
            [moderationCase.resource_id]
          );
        } else if (moderationCase.resource_type === 'comment') {
          const restored = await tx.query(
            `UPDATE community_comments SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING post_id`,
            [moderationCase.resource_id]
          );
          if (restored.rowCount > 0) {
            await queries.adjustPostCommentCount(restored.rows[0].post_id, 1, tx);
          }
        }
        await queries.updateModerationCase(
          moderationCase.id,
          { state: 'dismissed', resolvedAt: new Date() },
          tx
        );
      }

      await queries.insertAuditEvent(tx, {
        actorId,
        action: `moderation.appeal_${status}`,
        resourceType: 'moderation_appeal',
        resourceId: appealId,
        before: { status: appeal.status },
        after: { status, resolution },
      });
      return updatedAppeal;
    });
  }

  async function listCases({ state, limit, cursor }) {
    return queries.listModerationCases({ state, limit, cursor });
  }

  async function listAudit({ limit, cursor, resourceType, resourceId }) {
    return queries.listAuditEvents({ limit, cursor, resourceType, resourceId });
  }

  return {
    submitReport,
    decide,
    submitAppeal,
    decideAppeal,
    listCases,
    listAudit,
  };
}

export default createModerationService;