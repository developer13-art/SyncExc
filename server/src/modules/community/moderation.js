/**
 * SyncExc Server — Community moderation service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

const VALID_ACTIONS = [
  'dismiss',
  'remove_content',
  'add_warning',
  'restrict_posting',
  'suspend_group',
  'refer_to_admin',
  'reverse_action',
];

export function createModerationService({ db, queries, events, logger }) {
  async function submitReport({ userId, resourceType, resourceId, reason, details }) {
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

    const newState = action === 'dismiss' || action === 'reverse_action'
      ? 'dismissed'
      : action === 'refer_to_admin'
      ? 'escalated'
      : 'resolved';

    return db.tx(async (tx) => {
      const updated = await queries.updateModerationCase(caseId, {
        state: newState,
        resolvedAt: new Date(),
      });

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
            `UPDATE community_posts SET deleted_at = now() WHERE id = $1`,
            [moderationCase.resource_id]
          );
        } else if (moderationCase.resource_type === 'comment') {
          await tx.query(
            `UPDATE community_comments SET deleted_at = now() WHERE id = $1`,
            [moderationCase.resource_id]
          );
        }
      }

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

    return db.tx(async (tx) => {
      return queries.insertModerationAppeal(tx, {
        caseId,
        appellantId: userId,
        reason,
      });
    });
  }

  async function listCases({ state, limit, cursor }) {
    return queries.listModerationCases({ state, limit, cursor });
  }

  return {
    submitReport,
    decide,
    submitAppeal,
    listCases,
  };
}

export default createModerationService;