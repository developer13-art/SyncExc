/**
 * SyncExc Server — Push channel
 */

export function createPushChannel({ push, db, queries, deviceService, logger }) {
  return {
    async send({ notification }) {
      if (!push || !push.isEnabled?.()) {
        logger.warn({ notificationId: notification.id }, 'Push not configured');
        return { ok: false, error: 'push_not_configured' };
      }

      const subscriptions = await queries.listPushSubscriptions(notification.user_id);
      if (subscriptions.length === 0) {
        return { ok: false, error: 'no_push_subscriptions' };
      }

      let delivered = 0;
      let lastError = null;

      for (const sub of subscriptions) {
        try {
          const result = await push.send(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            {
              title: notification.title,
              body: notification.message,
              action: notification.action,
              notificationId: notification.id,
              priority: notification.priority,
              category: notification.category,
            }
          );

          delivered += 1;
          await deviceService.markUsed({ subscriptionId: sub.id });

          logger.trace(
            { notificationId: notification.id, subscriptionId: sub.id, statusCode: result.statusCode },
            'Push sent'
          );
        } catch (err) {
          lastError = err.message;
          if (err.invalid) {
            // 410 Gone / 404 Not Found — subscription is no longer valid
            await deviceService.markInvalid({ subscriptionId: sub.id });
          }
          logger.warn(
            { err, subscriptionId: sub.id, notificationId: notification.id },
            'Push send failed for subscription'
          );
        }
      }

      if (delivered > 0) {
        return { ok: true, providerRef: `push:${delivered}` };
      }
      return { ok: false, error: lastError || 'push_failed' };
    },
  };
}

export default createPushChannel;