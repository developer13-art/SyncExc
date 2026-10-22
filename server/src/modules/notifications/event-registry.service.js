/**
 * SyncExc Server — Notification event registry
 *
 * Defines which events produce notifications. Every event must be
 * registered before it can be notified.
 */

export function createEventRegistry({ queries, logger }) {
  const defaults = [
    // Account security
    { eventType: 'user.login_success', category: 'security', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'user.suspicious_login', category: 'security', defaultPriority: 'critical', defaultChannels: ['in_app', 'email'] },
    { eventType: 'user.password_changed', category: 'security', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },
    { eventType: 'user.mfa_enabled', category: 'security', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },
    { eventType: 'user.mfa_disabled', category: 'security', defaultPriority: 'critical', defaultChannels: ['in_app', 'email'] },
    { eventType: 'user.recovery_codes_regenerated', category: 'security', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },
    { eventType: 'user.email_changed', category: 'security', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },
    { eventType: 'user.session_revoked', category: 'security', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'user.trusted_device_added', category: 'security', defaultPriority: 'normal', defaultChannels: ['in_app', 'email'] },
    { eventType: 'user.restricted', category: 'security', defaultPriority: 'critical', defaultChannels: ['in_app', 'email'] },
    { eventType: 'user.restored', category: 'security', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },

    // Billing
    { eventType: 'billing.payment_succeeded', category: 'billing', defaultPriority: 'normal', defaultChannels: ['in_app', 'email'] },
    { eventType: 'billing.payment_failed', category: 'billing', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },
    { eventType: 'billing.subscription_activated', category: 'billing', defaultPriority: 'normal', defaultChannels: ['in_app', 'email'] },
    { eventType: 'billing.subscription_expiring', category: 'billing', defaultPriority: 'normal', defaultChannels: ['in_app', 'email'] },
    { eventType: 'billing.subscription_canceled', category: 'billing', defaultPriority: 'normal', defaultChannels: ['in_app', 'email'] },
    { eventType: 'billing.refund_completed', category: 'billing', defaultPriority: 'normal', defaultChannels: ['in_app', 'email'] },

    // Orders and execution
    { eventType: 'execution.order_acknowledged', category: 'trading', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'execution.order_partially_filled', category: 'trading', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'execution.order_filled', category: 'trading', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'execution.order_rejected', category: 'trading', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },
    { eventType: 'execution.order_canceled', category: 'trading', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'execution.outcome_uncertain', category: 'trading', defaultPriority: 'critical', defaultChannels: ['in_app', 'email'] },

    // Sync
    { eventType: 'sync.operation_completed', category: 'sync', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'sync.operation_failed', category: 'sync', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },
    { eventType: 'sync.reconciliation_required', category: 'sync', defaultPriority: 'critical', defaultChannels: ['in_app', 'email'] },

    // Risk
    { eventType: 'risk.blocked', category: 'risk', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },
    { eventType: 'risk.approval_requested', category: 'risk', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },
    { eventType: 'risk.circuit_breaker_activated', category: 'risk', defaultPriority: 'critical', defaultChannels: ['in_app', 'email'] },
    { eventType: 'risk.emergency_pause_active', category: 'risk', defaultPriority: 'critical', defaultChannels: ['in_app', 'email'] },

    // Sources
    { eventType: 'source.health_changed', category: 'sources', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'source.activated', category: 'sources', defaultPriority: 'low', defaultChannels: ['in_app'] },
    { eventType: 'source.paused', category: 'sources', defaultPriority: 'normal', defaultChannels: ['in_app'] },

    // Signals
    { eventType: 'signal.message_received', category: 'signals', defaultPriority: 'low', defaultChannels: ['in_app'] },
    { eventType: 'signal.eligible', category: 'signals', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'signal.blocked', category: 'signals', defaultPriority: 'high', defaultChannels: ['in_app'] },
    { eventType: 'signal.review_required', category: 'signals', defaultPriority: 'normal', defaultChannels: ['in_app'] },

    // Automation
    { eventType: 'automation.run_started', category: 'automation', defaultPriority: 'low', defaultChannels: ['in_app'] },
    { eventType: 'automation.run_completed', category: 'automation', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'automation.run_failed', category: 'automation', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },
    { eventType: 'automation.approval_required', category: 'automation', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },

    // Marketplace
    { eventType: 'marketplace.copy_config_activated', category: 'marketplace', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'marketplace.copy_config_revoked', category: 'marketplace', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'marketplace.copy_signal_processed', category: 'marketplace', defaultPriority: 'low', defaultChannels: ['in_app'] },

    // Referral
    { eventType: 'referral.commission_accrued', category: 'referral', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'referral.payout_processed', category: 'referral', defaultPriority: 'normal', defaultChannels: ['in_app', 'email'] },
    { eventType: 'referral.fraud_case_opened', category: 'referral', defaultPriority: 'high', defaultChannels: ['in_app'] },

    // Developer
    { eventType: 'developer.credential_revoked', category: 'developer', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },
    { eventType: 'developer.webhook_failed', category: 'developer', defaultPriority: 'normal', defaultChannels: ['in_app'] },

    // Support
    { eventType: 'support.ticket_created', category: 'support', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'support.ticket_assigned', category: 'support', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'support.ticket_escalated', category: 'support', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },
    { eventType: 'support.ticket_resolved', category: 'support', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'support.ticket_reopened', category: 'support', defaultPriority: 'normal', defaultChannels: ['in_app'] },

    // Platform
    { eventType: 'platform.incident_created', category: 'platform', defaultPriority: 'critical', defaultChannels: ['in_app', 'email'] },
    { eventType: 'platform.incident_updated', category: 'platform', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'platform.incident_resolved', category: 'platform', defaultPriority: 'normal', defaultChannels: ['in_app', 'email'] },

    // Community
    { eventType: 'community.post_published', category: 'community', defaultPriority: 'low', defaultChannels: ['in_app'] },
    { eventType: 'community.comment_posted', category: 'community', defaultPriority: 'low', defaultChannels: ['in_app'] },
    { eventType: 'community.follow_created', category: 'community', defaultPriority: 'low', defaultChannels: ['in_app'] },
    { eventType: 'community.follow_request_created', category: 'community', defaultPriority: 'low', defaultChannels: ['in_app'] },
    { eventType: 'community.follow_request_accepted', category: 'community', defaultPriority: 'low', defaultChannels: ['in_app'] },
    { eventType: 'community.message_request_created', category: 'community', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'community.message_request_accepted', category: 'community', defaultPriority: 'low', defaultChannels: ['in_app'] },
    { eventType: 'community.message_request_rejected', category: 'community', defaultPriority: 'low', defaultChannels: ['in_app'] },
    { eventType: 'community.message_received', category: 'community', defaultPriority: 'normal', defaultChannels: ['in_app'] },
    { eventType: 'community.moderation_action', category: 'community', defaultPriority: 'high', defaultChannels: ['in_app', 'email'] },
  ];

  const registry = new Map();

  // Preload defaults
  for (const def of defaults) {
    registry.set(def.eventType, def);
  }

  function register(def) {
    if (!def.eventType || !def.category || !def.defaultPriority) {
      throw new Error('Event definition requires eventType, category, defaultPriority');
    }
    registry.set(def.eventType, def);
  }

  function get(eventType) {
    return registry.get(eventType) || null;
  }

  function has(eventType) {
    return registry.has(eventType);
  }

  function list() {
    return Array.from(registry.values());
  }

  /**
   * Persist all registered event types into the DB. Called at bootstrap.
   */
  async function persistDefaults() {
    for (const def of registry.values()) {
      await queries.upsertEventType(null, {
        eventType: def.eventType,
        category: def.category,
        defaultPriority: def.defaultPriority,
        defaultChannels: def.defaultChannels,
        description: def.description || null,
      });
    }
    logger.info({ count: registry.size }, 'Notification event types persisted');
  }

  return {
    register,
    get,
    has,
    list,
    persistDefaults,
  };
}

export default createEventRegistry;