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
    if (syncGroupId) {
      const syncGroup = await db.query(
        `SELECT id FROM sync_groups WHERE id = $1 AND workspace_id = $2`,
        [syncGroupId, workspaceId]
      );
      if (!syncGroup.rows[0]) throw new NotFoundError('Sync group');
    }

    const sourceResult = await db.query(
      `
      SELECT s.id, s.workspace_id, s.status, s.monitoring_enabled,
             w.status AS workspace_status,
             sc.status AS connection_status,
             sc.authorization_status,
             config.mode AS configured_mode
      FROM signal_sources s
      JOIN workspaces w ON w.id = s.workspace_id
      LEFT JOIN LATERAL (
        SELECT status, authorization_status
        FROM signal_source_connections
        WHERE source_id = s.id
        ORDER BY created_at DESC
        LIMIT 1
      ) sc ON true
      LEFT JOIN LATERAL (
        SELECT mode
        FROM signal_source_execution_configs
        WHERE source_id = s.id AND workspace_id = w.id
        ORDER BY version DESC
        LIMIT 1
      ) config ON true
      WHERE s.id = $1
      `,
      [candidate.source_id]
    );
    const source = sourceResult.rows[0];
    if (!source || source.workspace_id !== workspaceId) throw new NotFoundError('Candidate');
    if (source.workspace_status !== 'active') {
      throw new ConflictError('The active workspace is paused or unavailable', 'WORKSPACE_NOT_ACTIVE');
    }
    if (source.status !== 'active' || !source.monitoring_enabled ||
        source.connection_status !== 'active' || source.authorization_status !== 'authorized') {
      throw new ConflictError('The selected signal source is not actively monitored', 'SOURCE_MONITORING_DISABLED');
    }
    const configuredMode = source.configured_mode || 'review';
    if (executionMode === 'monitor_only' || configuredMode === 'monitor_only') {
      throw new ConflictError('This source is configured for monitoring only', 'EXECUTION_DISABLED');
    }
    if (executionMode === 'simulation_only' || configuredMode === 'simulate') {
      throw new ConflictError(
        'Simulation is isolated from exchange execution intents; use the Simulation workspace flow',
        'SIMULATION_HANDOFF_UNAVAILABLE'
      );
    }
    if (executionMode === 'authorized_automation' && configuredMode !== 'live') {
      throw new ConflictError('Authorized automation requires explicit live mode for this source', 'LIVE_MODE_REQUIRED');
    }
    if (executionMode === 'confirm_before_execution' && !['review', 'live'].includes(configuredMode)) {
      throw new ConflictError('The source configuration does not allow reviewed execution', 'REVIEW_MODE_REQUIRED');
    }

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
      throw new ConflictError('Candidate has no current successful risk and eligibility decision', 'NOT_ELIGIBLE');
    }

    const destinationResult = await db.query(
      `
      SELECT d.account_id, a.account_type, a.status AS account_status,
             c.status AS connection_status, c.environment
      FROM signal_source_destinations d
      JOIN exchange_accounts a ON a.id = d.account_id
      JOIN exchange_connections c ON c.id = a.connection_id
      WHERE d.source_id = $1 AND d.workspace_id = $2 AND d.enabled = true
        AND a.status = 'active' AND c.status = 'active' AND c.workspace_id = $2
      ORDER BY d.created_at
      `,
      [candidate.source_id, workspaceId]
    );
    if (executionMode !== 'simulation_only' && destinationResult.rows.length === 0) {
      throw new ConflictError('Select at least one active destination account before execution', 'DESTINATION_REQUIRED');
    }
    if (configuredMode === 'live' &&
        destinationResult.rows.some((destination) => destination.environment !== 'live')) {
      throw new ConflictError('Live mode requires live destinations; testnet accounts cannot be used', 'LIVE_DESTINATION_REQUIRED');
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
      `intent:${candidateId}:${candidate.current_version}:${syncGroupId || 'default'}:${executionMode}`
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

      for (const destination of destinationResult.rows) {
        await tx.query(
          `
          INSERT INTO trading_execution_destination_results
            (intent_id, account_id, idempotency_key, status)
          VALUES ($1, $2, $3, 'pending')
          ON CONFLICT (idempotency_key) DO NOTHING
          `,
          [
            created.id,
            destination.account_id,
            fnv1aHash(`destination:${idempotencyKey}:${destination.account_id}`),
          ]
        );
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

  async function cancelIntent({ userId, workspaceId, intentId, reason }) {
    const intent = await queries.findExecutionIntentById(intentId);
    if (!intent || intent.workspace_id !== workspaceId) throw new NotFoundError('Intent');
    if (!['created', 'held'].includes(intent.status)) {
      throw new ConflictError('Intent cannot be canceled in its current state', 'INVALID_STATE');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateExecutionIntentStatus(intentId, 'canceled', new Date());
      await tx.query(
        `
        UPDATE trading_execution_destination_results
        SET status = 'cancelled', completed_at = now()
        WHERE intent_id = $1 AND status = 'pending'
        `,
        [intentId]
      );

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

  async function getIntent({ workspaceId, intentId }) {
    const intent = await queries.findExecutionIntentById(intentId);
    if (!intent || intent.workspace_id !== workspaceId) throw new NotFoundError('Intent');
    const destinations = await queries.listExecutionDestinationResults(intentId);
    return { ...intent, destinations };
  }

  return {
    createIntent,
    cancelIntent,
    getIntent,
  };
}

export default createIntentHandoffService;