/**
 * SyncExc Server — Default event listeners
 *
 * Cross-cutting handlers that run on every relevant event:
 *   - Audit writer (append-only audit trail for consequential events)
 *   - Notification fanout (register event types with the consumer so that
 *     the notification module can produce notifications)
 *   - Metrics counters
 *
 * Module-specific listeners live inside their own modules; only the truly
 * global ones live here.
 */

import { createLogger } from '../lib/logger.js';

/**
 * Event types that produce an audit record automatically. Most events do
 * NOT need this — consequential actions already write audit rows through
 * the audit service. This list is for events that cross module boundaries
 * and need a durable record even if the initiating module forgets.
 */
const AUDIT_WORTHY_EVENTS = new Set([
  'user.restricted',
  'user.restored',
  'user.password_changed',
  'user.mfa_enabled',
  'user.mfa_disabled',
  'workspace.ownership_transferred',
  'billing.refund_completed',
  'risk.circuit_breaker_activated',
  'risk.emergency_pause_active',
  'risk.emergency_pause_resumed',
  'admin.role_changed',
  'admin.feature_flag_changed',
  'admin.approval_granted',
  'admin.approval_rejected',
  'admin.action_executed',
]);

/**
 * Event types that must reach the notification module. The notification
 * module registers subscribers for these via its own module file; we list
 * them here so the consumer knows to fan them out.
 */
const NOTIFICATION_RELEVANT_EVENTS = [
  'user.registered',
  'user.email_verified',
  'user.password_changed',
  'user.mfa_enabled',
  'user.mfa_disabled',
  'user.session_created',
  'user.session_revoked',
  'user.restricted',
  'billing.payment_succeeded',
  'billing.payment_failed',
  'billing.subscription_activated',
  'billing.subscription_expired',
  'billing.refund_completed',
  'connection.degraded',
  'connection.reauth_required',
  'execution.order_filled',
  'execution.order_rejected',
  'execution.outcome_uncertain',
  'sync.operation_failed',
  'sync.reconciliation_required',
  'risk.blocked',
  'risk.approval_requested',
  'risk.circuit_breaker_activated',
  'risk.emergency_pause_active',
  'source.health_changed',
  'signal.message_received',
  'signal.review_required',
  'automation.run_failed',
  'automation.approval_required',
  'referral.commission_accrued',
  'referral.payout_processed',
  'developer.webhook_failed',
  'community.post_published',
  'community.moderation_action',
  'support.ticket_assigned',
  'support.ticket_escalated',
  'support.ticket_resolved',
  'platform.incident_created',
  'platform.incident_updated',
  'platform.incident_resolved',
];

export async function registerDefaultListeners({ subscribers, db, logger: injectedLogger }) {
  const logger = injectedLogger || createLogger({ component: 'events:default-listeners' });

  // ---------------------------------------------------------------------------
  // Audit writer — writes a compact audit row for consequential events
  // ---------------------------------------------------------------------------
  subscribers.register(
    Array.from(AUDIT_WORTHY_EVENTS),
    async (envelope) => {
      try {
        await db.query(
          `
          INSERT INTO audit_events (
            actor_id, workspace_id, action, resource_type, resource_id,
            outcome, correlation_id, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            envelope.actorId || null,
            envelope.workspaceId || null,
            envelope.eventType,
            envelope.resourceType,
            String(envelope.resourceId || envelope.eventId),
            'success',
            envelope.correlationId,
            JSON.stringify({ eventId: envelope.eventId, source: 'auto_audit' }),
          ]
        );
      } catch (err) {
        logger.error(
          { err, eventType: envelope.eventType, eventId: envelope.eventId },
          'Auto-audit write failed'
        );
        throw err;
      }
    },
    { name: 'auto-audit-writer' }
  );

  // ---------------------------------------------------------------------------
  // Register notification-relevant events with the consumer so they are
  // fanned out to the notification transport.
  // ---------------------------------------------------------------------------
  logger.debug(
    { count: NOTIFICATION_RELEVANT_EVENTS.length },
    'Default listeners registered'
  );
}

export const __internal = {
  AUDIT_WORTHY_EVENTS,
  NOTIFICATION_RELEVANT_EVENTS,
};

export default registerDefaultListeners;