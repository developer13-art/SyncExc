/**
 * SyncExc Server — Developer event listeners
 *
 * When any event of interest fires, dispatch to webhook subscribers.
 */

const DISPATCHABLE_EVENTS = [
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
  'developer.credential_revoked',
  'developer.application_suspended',
];

/**
 * Map internal event type → public webhook event type.
 */
const PUBLIC_EVENT_MAP = {
  'execution.order_acknowledged': 'order.accepted',
  'execution.order_partially_filled': 'order.partially_filled',
  'execution.order_filled': 'order.filled',
  'execution.order_rejected': 'order.rejected',
  'execution.order_canceled': 'order.cancelled',
  'sync.operation_completed': 'sync.completed',
  'sync.operation_failed': 'sync.partially_completed',
  'sync.reconciliation_required': 'sync.reconciliation_required',
  'signal.message_received': 'signal.received',
  'signal.eligible': 'signal.validated',
  'automation.run_completed': 'automation.run_completed',
  'automation.run_failed': 'automation.run_failed',
  'billing.payment_succeeded': 'payment.succeeded',
  'billing.subscription_activated': 'subscription.status_changed',
  'billing.subscription_canceled': 'subscription.status_changed',
};

export function createDeveloperListeners({
  events,
  webhookSubscriptionService,
  webhookDeliveryService,
  usageAnalyticsService,
  logger,
}) {
  for (const eventType of DISPATCHABLE_EVENTS) {
    const publicType = PUBLIC_EVENT_MAP[eventType] || eventType.replace(/\./g, '_');

    events.subscribe(
      eventType,
      async (envelope) => {
        try {
          await webhookDeliveryService.dispatchEvent({
            eventType: publicType,
            payload: envelope.payload,
            resourceType: envelope.resourceType,
            resourceId: envelope.resourceId,
          });
        } catch (err) {
          logger.error(
            { err, eventType, eventId: envelope.eventId },
            'Webhook dispatch failed'
          );
        }
      },
      { name: `developer:dispatch:${eventType}` }
    );
  }

  logger.debug(
    { subscribed: DISPATCHABLE_EVENTS.length },
    'Developer webhook dispatch listeners registered'
  );

  return {
    async shutdown() {},
  };
}

export default createDeveloperListeners;