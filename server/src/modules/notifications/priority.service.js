/**
 * SyncExc Server — Priority service
 *
 * Priority is derived from the event type and contextual signals. External
 * content can never assign privileged priority.
 */

export function createPriorityService({ logger }) {
  const CATEGORY_OVERRIDES = {
    risk: {
      'risk.circuit_breaker_activated': 'critical',
      'risk.emergency_pause_active': 'critical',
      'risk.blocked': 'high',
      'risk.approval_requested': 'high',
    },
    security: {
      'user.suspicious_login': 'critical',
      'user.mfa_disabled': 'critical',
      'user.restricted': 'critical',
    },
    trading: {
      'execution.outcome_uncertain': 'critical',
      'execution.order_rejected': 'high',
    },
    sync: {
      'sync.reconciliation_required': 'critical',
      'sync.operation_failed': 'high',
    },
  };

  /**
   * Determine the effective priority for a notification.
   *
   * @param {Object} params
   * @param {string} params.eventType
   * @param {string} params.category
   * @param {string} params.defaultPriority
   * @param {Object} [params.context]   Additional signals (e.g. magnitude)
   * @returns {string}                  'low' | 'normal' | 'high' | 'critical'
   */
  function determine({ eventType, category, defaultPriority, context = {} }) {
    // Specific event overrides
    const override = CATEGORY_OVERRIDES[category]?.[eventType];
    if (override) return override;

    // Magnitude escalation — e.g. very large blocked orders become critical
    if (context.magnitude === 'large' && defaultPriority === 'high') {
      return 'critical';
    }

    return defaultPriority || 'normal';
  }

  return {
    determine,
  };
}

export default createPriorityService;