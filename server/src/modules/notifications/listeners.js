/**
 * SyncExc Server — Notification event listeners
 *
 * Subscribes to every event that might produce a notification. The
 * orchestrator decides which ones actually become notifications.
 */

const NOTIFIABLE_EVENTS = [
  // Security
  'user.login_success',
  'user.password_changed',
  'user.mfa_enabled',
  'user.mfa_disabled',
  'user.recovery_codes_regenerated',
  'user.email_changed',
  'user.session_revoked',
  'user.trusted_device_added',
  'user.restricted',
  'user.restored',

  // Billing
  'billing.payment_succeeded',
  'billing.payment_failed',
  'billing.subscription_activated',
  'billing.subscription_expiring',
  'billing.subscription_canceled',
  'billing.refund_completed',

  // Trading
  'execution.order_acknowledged',
  'execution.order_partially_filled',
  'execution.order_filled',
  'execution.order_rejected',
  'execution.order_canceled',
  'execution.outcome_uncertain',

  // Sync
  'sync.operation_completed',
  'sync.operation_failed',
  'sync.reconciliation_required',

  // Risk
  'risk.blocked',
  'risk.approval_requested',
  'risk.circuit_breaker_activated',
  'risk.emergency_pause_active',

  // Sources
  'source.health_changed',
  'source.activated',
  'source.paused',

  // Signals
  'signal.eligible',
  'signal.blocked',
  'signal.review_required',
  'signal.message_received',

  // Automation
  'automation.run_started',
  'automation.run_completed',
  'automation.run_failed',
  'automation.approval_required',

  // Marketplace
  'marketplace.copy_config_activated',
  'marketplace.copy_config_revoked',
  'marketplace.copy_signal_processed',

  // Referral
  'referral.commission_accrued',
  'referral.payout_processed',
  'referral.fraud_case_opened',

  // Developer
  'developer.credential_revoked',
  'developer.webhook_failed',

  // Support
  'support.ticket_created',
  'support.ticket_assigned',
  'support.ticket_escalated',
  'support.ticket_resolved',
  'support.ticket_reopened',

  // Platform
  'platform.incident_created',
  'platform.incident_updated',
  'platform.incident_resolved',

  // Community
  'community.post_published',
  'community.comment_posted',
  'community.follow_created',
  'community.follow_request_created',
  'community.follow_request_accepted',
  'community.message_request_created',
  'community.message_request_accepted',
  'community.message_request_rejected',
  'community.message_received',
  'community.moderation_action',
];

export function createNotificationListeners({ events, orchestrator, logger }) {
  for (const eventType of NOTIFIABLE_EVENTS) {
    events.subscribe(
      eventType,
      async (envelope) => {
        try {
          await orchestrator.processEvent({
            eventType,
            payload: envelope.payload || {},
            actorId: envelope.actorId,
            workspaceId: envelope.workspaceId,
            resourceType: envelope.resourceType,
            resourceId: envelope.resourceId,
            correlationId: envelope.correlationId,
          });
        } catch (err) {
          logger.error(
            { err, eventType, eventId: envelope.eventId },
            'Notification orchestration failed'
          );
        }
      },
      { name: `notifications:${eventType}` }
    );
  }

  logger.debug(
    { subscribed: NOTIFIABLE_EVENTS.length },
    'Notification event listeners registered'
  );

  return {
    async shutdown() {},
  };
}

export default createNotificationListeners;