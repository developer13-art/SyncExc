/**
 * SyncExc Server — Webhook channel
 *
 * Sends notifications to a user's configured webhook destination.
 */

import { signWebhookPayload } from '../../../lib/crypto.js';

export function createWebhookChannel({ db, queries, logger }) {
  return {
    async send({ notification }) {
      // Webhook channel requires the user to have configured a destination.
      const result = await db.query(
        `
        SELECT destination_url, signing_secret_ref FROM user_webhook_destinations
        WHERE user_id = $1 AND enabled = true
        LIMIT 1
        `,
        [notification.user_id]
      );

      if (result.rows.length === 0) {
        return { ok: false, error: 'no_webhook_destination' };
      }

      const destination = result.rows[0];
      const body = JSON.stringify({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        category: notification.category,
        priority: notification.priority,
        action: notification.action,
        createdAt: notification.created_at,
      });

      const timestamp = Math.floor(Date.now() / 1000);
      const { signature } = signWebhookPayload(body, destination.signing_secret_ref, timestamp);

      try {
        const res = await fetch(destination.destination_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SyncExc-Signature': signature,
            'X-SyncExc-Timestamp': String(timestamp),
            'X-SyncExc-Event-Id': notification.id,
          },
          body,
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          return { ok: false, error: `HTTP ${res.status}` };
        }

        return { ok: true, providerRef: `webhook:${res.status}` };
      } catch (err) {
        logger.warn({ err, notificationId: notification.id }, 'Webhook send failed');
        return { ok: false, error: err.message };
      }
    },
  };
}

export default createWebhookChannel;