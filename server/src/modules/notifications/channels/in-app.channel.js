/**
 * SyncExc Server — In-app notification channel
 *
 * In-app notifications are persisted by the notification service. This
 * channel is a no-op that always succeeds because the record already exists.
 */

export function createInAppChannel({ db, queries, logger }) {
  return {
    async send({ notification }) {
      // The notification record already exists. Broadcasting happens in the
      // notification service.
      logger.trace({ notificationId: notification.id }, 'In-app delivery no-op');
      return { ok: true, providerRef: 'in_app' };
    },
  };
}

export default createInAppChannel;