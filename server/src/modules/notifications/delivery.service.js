/**
 * SyncExc Server — Delivery service
 *
 * Manages channel deliveries: enqueue, dispatch, retry, dead-letter.
 * Uses bounded exponential backoff and dead-letters after max attempts.
 */

import { backoffDelay } from '@syncexc/shared';
import { NotFoundError } from '../../lib/errors.js';

const MAX_ATTEMPTS = 5;

export function createDeliveryService({
  db,
  queries,
  channels,
  templateService,
  preferencesService,
  deduplicationService,
  deviceService,
  events,
  logger,
}) {
  /**
   * Enqueue a delivery for a specific channel.
   */
  async function enqueue({ notificationId, channel }) {
    return db.tx(async (tx) => {
      const delivery = await queries.insertDelivery(tx, {
        notificationId,
        channel,
      });
      return delivery;
    });
  }

  /**
   * Process all pending deliveries. Called by the job runner on a schedule.
   */
  async function processPending({ limit = 100 } = {}) {
    const result = await db.query(
      `
      SELECT d.* FROM notification_deliveries d
      WHERE d.state IN ('pending', 'retry_scheduled')
        AND (d.next_retry_at IS NULL OR d.next_retry_at <= now())
      ORDER BY d.created_at ASC
      LIMIT $1
      `,
      [limit]
    );

    let delivered = 0;
    let failed = 0;
    let retried = 0;

    for (const delivery of result.rows) {
      const outcome = await deliver(delivery.id);
      if (outcome.state === 'delivered') delivered += 1;
      else if (outcome.state === 'retry_scheduled') retried += 1;
      else failed += 1;
    }

    return { delivered, failed, retried, total: result.rows.length };
  }

  /**
   * Deliver a single notification through its channel.
   */
  async function deliver(deliveryId) {
    const delivery = await queries.findDeliveryById(deliveryId);
    if (!delivery) throw new NotFoundError('Delivery');
    if (['delivered', 'dead_lettered', 'suppressed'].includes(delivery.state)) {
      return delivery;
    }

    const notification = await queries.findNotificationById(delivery.notification_id);
    if (!notification) {
      await queries.updateDelivery(deliveryId, {
        state: 'failed',
        failureReason: 'notification_not_found',
      });
      return { state: 'failed' };
    }

    const channel = channels[delivery.channel];
    if (!channel) {
      await queries.updateDelivery(deliveryId, {
        state: 'failed',
        failureReason: 'channel_not_registered',
      });
      return { state: 'failed' };
    }

    // Re-check permission at delivery time
    const permission = await preferencesService.shouldDeliver({
      userId: notification.user_id,
      workspaceId: null,
      category: notification.category,
      notificationType: notification.event_type,
      channel: delivery.channel,
      priority: notification.priority,
    });

    if (!permission.allowed) {
      await db.tx(async (tx) => {
        await queries.updateDelivery(deliveryId, {
          state: 'suppressed',
          failureReason: permission.reason,
        });
        await queries.insertDeliveryAttempt(tx, {
          deliveryId,
          attemptNumber: (delivery.attempt_count || 0) + 1,
          state: 'suppressed',
          errorMessage: permission.reason,
        });
      });
      return { state: 'suppressed' };
    }

    const attemptNumber = (delivery.attempt_count || 0) + 1;

    let result;
    try {
      result = await channel.send({
        notification,
        delivery,
        attemptNumber,
      });
    } catch (err) {
      result = { ok: false, error: err.message };
    }

    if (result.ok) {
      await db.tx(async (tx) => {
        await queries.updateDelivery(deliveryId, {
          state: 'delivered',
          attemptCount: attemptNumber,
          providerRef: result.providerRef || null,
          deliveredAt: new Date(),
        });
        await queries.insertDeliveryAttempt(tx, {
          deliveryId,
          attemptNumber,
          state: 'delivered',
          providerRef: result.providerRef || null,
        });
      });

      // Mark notification delivered
      await queries.updateNotificationStatus(notification.id, 'delivered');

      return { state: 'delivered' };
    }

    // Failed attempt
    const isLastAttempt = attemptNumber >= MAX_ATTEMPTS;

    await db.tx(async (tx) => {
      if (isLastAttempt) {
        await queries.updateDelivery(deliveryId, {
          state: 'dead_lettered',
          attemptCount: attemptNumber,
          failureReason: result.error,
        });
      } else {
        const nextRetryAt = new Date(Date.now() + backoffDelay(attemptNumber - 1, 5000, 300000));
        await tx.query(
          `UPDATE notification_deliveries SET next_retry_at = $2 WHERE id = $1`,
          [deliveryId, nextRetryAt]
        );
        await queries.updateDelivery(deliveryId, {
          state: 'retry_scheduled',
          attemptCount: attemptNumber,
          failureReason: result.error,
        });
      }

      await queries.insertDeliveryAttempt(tx, {
        deliveryId,
        attemptNumber,
        state: isLastAttempt ? 'dead_lettered' : 'retry_scheduled',
        errorMessage: result.error,
      });
    });

    if (isLastAttempt) {
      logger.error(
        { deliveryId, channel: delivery.channel, error: result.error },
        'Delivery dead-lettered'
      );
      await events.publish(
        db,
        'notification.delivery_failed',
        {
          deliveryId,
          notificationId: notification.id,
          channel: delivery.channel,
          attempts: attemptNumber,
        },
        {
          resourceType: 'notification_delivery',
          resourceId: deliveryId,
        }
      );
      return { state: 'dead_lettered' };
    }

    return { state: 'retry_scheduled' };
  }

  return {
    enqueue,
    processPending,
    deliver,
  };
}

export default createDeliveryService;