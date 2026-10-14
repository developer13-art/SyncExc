/**
 * SyncExc Server — Billing events
 */

export const BILLING_EMITS = [
  'billing.subscription_created',
  'billing.subscription_activated',
  'billing.subscription_renewed',
  'billing.subscription_canceled',
  'billing.subscription_expired',
  'billing.payment_succeeded',
  'billing.payment_failed',
  'billing.refund_completed',
  'billing.entitlement_granted',
  'billing.entitlement_revoked',
];

export const BILLING_CONSUMES = [];

export function registerBillingEventHandlers({ events, service, logger }) {
  logger.debug(
    { emits: BILLING_EMITS.length, consumes: BILLING_CONSUMES.length },
    'Billing event handlers registered'
  );
}

export default registerBillingEventHandlers;