/**
 * SyncExc Server — Execution intent handoff
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';
import { fnv1aHash } from '@syncexc/shared';

export function createIntentHandoffService({ db, queries, events, logger }) {
  /**
   * Create an execution intent for an eligible candidate.
   */
  async function createIntent({
    userId,
    candidateId,
    workspaceId,
    syncGroupId,
    executionMode,
  }) {
    const candidate = await queries.findCandidateById(candidateId);
    if (!candidate) throw new NotFoundError('Candidate');

    const eligibility = await db.query(
      `
      SELECT * FROM trading_signal_eligibility_decisions
      WHERE candidate_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [candidateId]
    );
    const decision = eligibility.rows[0];
    if (!decision || decision.outcome !== 'eligible_for_handoff') {
      throw new ConflictError('Candidate is not eligible for handoff', 'NOT_ELIGIBLE');
    }

    const targets = await queries.listTargetsForCandidate(candidateId);

    const payload = {
      instrument: candidate.instrument,
      marketType: candidate.market_type,
      direction: candidate.direction,
      entry: candidate.entry,
      entryRange: candidate.entry_range,
      stopLoss: candidate.stop_loss,
      targets: targets.map((t) => ({ label: t.label, value: t.value })),
      leverage: candidate.leverage,
      executionMode,
    };

    const idempotencyKey = fnv1aHash(
      `intent:${candidateId}:${candidate.current_version}:${syncGroupId || 'default'}`
    );

    const intent = await db.tx(async (tx) => {
      const created = await queries.insertExecutionIntent(tx, {
        signalId: candidateId,
        signalVersion: candidate.current_version,
        workspaceId,
        syncGroupId,
        operationType: 'signal_execution',
        payload,
        eligibilityDecisionId: decision.id,
        idempotencyKey,
        status: 'created',
      });

      if (!created) {
        // Duplicate intent — return existing
        const existing = await db.query(
          `SELECT * FROM trading_execution_intents WHERE idempotency_key = $1`,
          [idempotencyKey]
        );
        return existing.rows[0];
      }

      await queries.insertIntentEvent(tx, {
        intentId: created.id,
        eventType: 'created',
        actorId: userId,
      });

      await events.publish(
        tx,
        'signal.intent_created',
        {
          intentId: created.id,
          candidateId,
          workspaceId,
          syncGroupId,
        },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'execution_intent',
          resourceId: created.id,
        }
      );

      return created;
    });

    return intent;
  }

  async function cancelIntent({ userId, intentId, reason }) {
    const intent = await queries.findExecutionIntentById(intentId);
    if (!intent) throw new NotFoundError('Intent');
    if (!['created', 'held'].includes(intent.status)) {
      throw new ConflictError('Intent cannot be canceled in its current state', 'INVALID_STATE');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateExecutionIntentStatus(intentId, 'canceled', new Date());

      await queries.insertIntentEvent(tx, {
        intentId,
        eventType: 'canceled',
        actorId: userId,
        metadata: { reason },
      });

      await events.publish(
        tx,
        'signal.intent_canceled',
        { intentId, reason },
        {
          actorId: userId,
          workspaceId: intent.workspace_id,
          resourceType: 'execution_intent',
          resourceId: intentId,
        }
      );

      return updated;
    });
  }

  return {
    createIntent,
    cancelIntent,
  };
}

export default createIntentHandoffService;