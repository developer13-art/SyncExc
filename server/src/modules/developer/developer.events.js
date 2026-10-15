/**
 * SyncExc Server — Developer events
 */

export const DEVELOPER_EMITS = [
  'developer.application_created',
  'developer.credential_created',
  'developer.credential_revoked',
  'developer.webhook_subscribed',
  'developer.webhook_delivered',
  'developer.webhook_failed',
];

export const DEVELOPER_CONSUMES = [
  'execution.order_acknowledged',
  'execution.order_partially_filled',
  'execution.order_filled',
  'execution.order_rejected',
  'execution.order_canceled',
  'sync.operation_completed',
  'sync.operation_failed',
  'sync.reconciliation_required',
  'signal.message_received',
  'signal.eligible',
  'automation.run_completed',
  'automation.run_failed',
  'billing.payment_succeeded',
  'billing.subscription_activated',
  'billing.subscription_canceled',
];

export default {
  DEVELOPER_EMITS,
  DEVELOPER_CONSUMES,
};