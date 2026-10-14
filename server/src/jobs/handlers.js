/**
 * SyncExc Server — Job handlers
 *
 * Registers the handler for every job type. Handlers are thin adapters
 * that call into the relevant service. Business logic lives in the service,
 * not the handler.
 *
 * Adding a new job type:
 *   1. Add the constant in @syncexc/shared (JOB_TYPE).
 *   2. Register a handler here.
 *   3. Enqueue the job from wherever the work originates.
 */

import { createLogger } from '../lib/logger.js';

export async function registerAllHandlers({ registry, services }) {
  const logger = createLogger({ component: 'jobs:handlers' });

  const register = (type, fn, name) => {
    registry.register(type, async (ctx) => {
      try {
        await fn(ctx);
      } catch (err) {
        logger.error({ err, type, jobId: ctx.jobId }, `${name || type} handler failed`);
        throw err;
      }
    });
  };

  /* ===========================================================================
   * INFRASTRUCTURE / OUTBOX / AUDIT
   * ======================================================================== */

  register('outbox_publish', async ({ services: s }) => {
    await s.events.publisher.pollOnce();
  });

  register('audit_writer', async ({ payload }) => {
    // The auto-audit listener writes synchronously; this handler exists for
    // callers that want to enqueue an audit event explicitly.
    const { db } = services;
    await db.query(
      `
      INSERT INTO audit_events (
        actor_id, workspace_id, action, resource_type, resource_id,
        before, after, outcome, correlation_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        payload.actorId || null,
        payload.workspaceId || null,
        payload.action,
        payload.resourceType,
        String(payload.resourceId),
        payload.before ? JSON.stringify(payload.before) : null,
        payload.after ? JSON.stringify(payload.after) : null,
        payload.outcome || 'success',
        payload.correlationId || null,
        payload.metadata ? JSON.stringify(payload.metadata) : null,
      ]
    );
  });

  /* ===========================================================================
   * NOTIFICATIONS
   * ======================================================================== */

  register('notification_email', async ({ payload, services: s }) => {
    await s.notifications.deliverEmail(payload);
  });

  register('notification_push', async ({ payload, services: s }) => {
    await s.notifications.deliverPush(payload);
  });

  register('notification_inapp', async ({ payload, services: s }) => {
    await s.notifications.deliverInApp(payload);
  });

  /* ===========================================================================
   * DEVELOPER WEBHOOKS
   * ======================================================================== */

  register('webhook_delivery', async ({ payload, services: s }) => {
    await s.developer.webhooks.deliver(payload.deliveryId);
  });

  /* ===========================================================================
   * SYNCHRONIZATION
   * ======================================================================== */

  register('sync_dispatch', async ({ payload, services: s }) => {
    await s.synchronization.dispatcher.dispatchDestinationOperation(
      payload.destinationOperationId
    );
  });

  register('sync_reconcile', async ({ payload, services: s }) => {
    await s.synchronization.reconciliation.reconcileOperation(payload.operationId);
  });

  /* ===========================================================================
   * RISK MONITORING
   * ======================================================================== */

  register('risk_monitor', async ({ services: s }) => {
    await s.risk.monitoring.runContinuously();
  });

  /* ===========================================================================
   * SIGNAL PIPELINE
   * ======================================================================== */

  register('signal_ingest', async ({ payload, services: s }) => {
    await s.signals.ingestion.ingestMessage(payload);
  });

  register('signal_parse', async ({ payload, services: s }) => {
    await s.signals.parser.parseMessage(payload.messageId);
  });

  register('signal_validate', async ({ payload, services: s }) => {
    await s.signals.validation.validateCandidate(payload.candidateId);
  });

  /* ===========================================================================
   * SOURCE DISCOVERY & HEALTH
   * ======================================================================== */

  register('source_discovery', async ({ payload, services: s }) => {
    await s.sources.discovery.runDiscoveryJob(payload.jobId);
  });

  register('source_health', async ({ payload, services: s }) => {
    await s.sources.health.checkSource(payload.sourceId);
  });

  register('source_quality', async ({ payload, services: s }) => {
    await s.sources.quality.evaluateSource(payload.sourceId);
  });

  /* ===========================================================================
   * AUTOMATION
   * ======================================================================== */

  register('workflow_execute', async ({ payload, services: s }) => {
    await s.automation.engine.executeRun(payload.runId);
  });

  register('workflow_schedule', async ({ services: s }) => {
    await s.automation.schedule.tick();
  });

  /* ===========================================================================
   * SIMULATION
   * ======================================================================== */

  register('simulation_run', async ({ payload, services: s }) => {
    await s.simulation.runService.executeRun(payload.runId);
  });

  /* ===========================================================================
   * BILLING
   * ======================================================================== */

  register('billing_renewal', async ({ payload, services: s }) => {
    await s.billing.renewal.processRenewal(payload.subscriptionId);
  });

  register('billing_reconcile', async ({ payload, services: s }) => {
    await s.billing.reconciliation.reconcilePayment(payload.paymentId);
  });

  register('billing_webhook', async ({ payload, services: s }) => {
    await s.billing.webhooks.processEvent(payload.webhookEventId);
  });

  /* ===========================================================================
   * REFERRAL
   * ======================================================================== */

  register('referral_commission', async ({ payload, services: s }) => {
    await s.referral.commission.processPaymentForCommissions(payload.paymentId);
  });

  register('referral_payout', async ({ payload, services: s }) => {
    await s.referral.payout.processPayoutRequest(payload.payoutId);
  });

  register('referral_fraud', async ({ payload, services: s }) => {
    await s.referral.fraud.evaluateAffiliate(payload.affiliateId);
  });

  /* ===========================================================================
   * SEARCH / INDEXING
   * ======================================================================== */

  register('search_indexer', async ({ payload, services: s }) => {
    await s.community.search.indexResource(payload.resourceType, payload.resourceId);
  });

  /* ===========================================================================
   * EXPORTS
   * ======================================================================== */

  register('export_generator', async ({ payload, services: s }) => {
    await s.admin.exports.generate(payload.exportId);
  });

  /* ===========================================================================
   * CLEANUP
   * ======================================================================== */

  register('cleanup', async ({ payload, services: s }) => {
    const { db } = s;
    const target = payload?.target;

    if (target === 'outbox') {
      await db.query(
        `DELETE FROM outbox_events WHERE status = 'published' AND published_at < now() - interval '30 days'`
      );
    } else if (target === 'jobs') {
      await db.query(
        `DELETE FROM jobs WHERE status = 'completed' AND completed_at < now() - interval '30 days'`
      );
    } else if (target === 'idempotency') {
      await db.query(
        `DELETE FROM idempotency_keys WHERE state = 'completed' AND updated_at < now() - interval '30 days'`
      );
    } else if (target === 'sessions') {
      await db.query(
        `DELETE FROM user_sessions WHERE expires_at < now() - interval '30 days'`
      );
    } else if (target === 'challenges') {
      await db.query(
        `DELETE FROM auth_challenges WHERE expires_at < now() - interval '30 days'`
      );
    } else if (target === 'all') {
      await Promise.all([
        db.query(
          `DELETE FROM outbox_events WHERE status = 'published' AND published_at < now() - interval '30 days'`
        ),
        db.query(
          `DELETE FROM jobs WHERE status = 'completed' AND completed_at < now() - interval '30 days'`
        ),
        db.query(
          `DELETE FROM idempotency_keys WHERE state = 'completed' AND updated_at < now() - interval '30 days'`
        ),
        db.query(
          `DELETE FROM user_sessions WHERE expires_at < now() - interval '30 days'`
        ),
        db.query(
          `DELETE FROM auth_challenges WHERE expires_at < now() - interval '30 days'`
        ),
      ]);
    } else {
      logger.warn({ target }, 'Unknown cleanup target');
    }
  });

  logger.debug({ handlers: registry.list().length }, 'All job handlers registered');
}

export default registerAllHandlers;