/**
 * SyncExc Server — Moderation service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createModerationService({ db, queries, events, logger }) {
  async function openCase({ providerId, signalId, category }) {
    return db.tx(async (tx) => {
      const c = await queries.insertModerationCase(tx, {
        providerId,
        signalId,
        category,
        state: 'pending_review',
      });

      await queries.insertModerationEvent(tx, {
        caseId: c.id,
        action: 'opened',
        reason: category,
      });

      return c;
    });
  }

  async function decide({
    caseId,
    actorId,
    action, // approve | reject | request_info | suspend
    reason,
  }) {
    const moderationCase = await queries.findModerationCaseById(caseId);
    if (!moderationCase) throw new NotFoundError('Moderation case');
    if (moderationCase.state === 'resolved' || moderationCase.state === 'rejected') {
      throw new ConflictError('Case already closed', 'CASE_CLOSED');
    }

    let newState;
    switch (action) {
      case 'approve':
        newState = 'approved';
        break;
      case 'reject':
        newState = 'rejected';
        break;
      case 'request_info':
        newState = 'additional_information_required';
        break;
      case 'suspend':
        newState = 'suspended';
        break;
      default:
        throw new ConflictError(`Unknown moderation action: ${action}`);
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateModerationCaseState(caseId, newState);

      await queries.insertModerationEvent(tx, {
        caseId,
        actorId,
        action,
        reason,
      });

      // If a provider is being suspended, update their profile
      if (moderationCase.provider_id && action === 'suspend') {
        await queries.updateProviderModerationState(moderationCase.provider_id, 'suspended');
      }

      await events.publish(
        tx,
        'marketplace.moderation_action',
        { caseId, action, newState, reason },
        {
          actorId,
          resourceType: 'marketplace_moderation_case',
          resourceId: caseId,
        }
      );

      return updated;
    });
  }

  async function list({ state, limit, cursor }) {
    return queries.listModerationCases({ state, limit, cursor });
  }

  return {
    openCase,
    decide,
    list,
  };
}

export default createModerationService;