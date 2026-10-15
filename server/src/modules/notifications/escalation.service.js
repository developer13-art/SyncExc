/**
 * SyncExc Server — Escalation service
 *
 * Escalation applies when a notification is critical or when a delivery
 * fails. Real, actionable escalation.
 */

export function createEscalationService({ db, queries, events, logger }) {
  async function evaluateEscalation({ notification }) {
    if (notification.priority !== 'critical') return null;

    const policy = await queries.findEscalationPolicy(notification.category, notification.priority);
    if (!policy) return null;

    // Log the escalation
    const escalationEvent = await db.tx(async (tx) => {
      return queries.insertEscalationEvent(tx, {
        notificationId: notification.id,
        policyId: policy.id,
        outcome: 'escalated',
        metadata: { rules: policy.escalation_rules },
      });
    });

    logger.warn(
      { notificationId: notification.id, category: notification.category },
      'Critical notification escalated'
    );

    return escalationEvent;
  }

  async function handleDeliveryFailure({ deliveryId, notificationId, channel, attempts }) {
    // Persist an escalation event for failed critical deliveries
    const notification = await queries.findNotificationById(notificationId);
    if (!notification) return;

    if (notification.priority === 'critical') {
      await db.tx(async (tx) => {
        await queries.insertEscalationEvent(tx, {
          notificationId,
          policyId: null,
          outcome: 'delivery_failure_escalated',
          metadata: { deliveryId, channel, attempts },
        });
      });

      logger.error(
        { notificationId, channel, attempts },
        'Critical notification delivery failed; escalating'
      );
    }
  }

  return {
    evaluateEscalation,
    handleDeliveryFailure,
  };
}

export default createEscalationService;