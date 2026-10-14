/**
 * SyncExc Server — Push notification sender (Web Push / VAPID)
 *
 * No-op when VAPID keys are missing so the server can boot in any environment.
 */

import config from '../config.js';
import { createLogger } from './logger.js';

const logger = createLogger({ component: 'push' });

export async function initPush() {
  if (!config.push.enabled) {
    logger.warn('VAPID not configured; push notifications will be logged, not sent');
    return {
      async send(subscription, payload) {
        logger.info(
          { endpoint: subscription?.endpoint?.slice(0, 40), title: payload?.title },
          'Push suppressed (VAPID disabled)'
        );
        return { suppressed: true };
      },
      isEnabled: () => false,
    };
  }

  let webpush;
  try {
    webpush = (await import('web-push')).default;
  } catch {
    throw new Error('web-push not installed but VAPID is enabled');
  }

  webpush.setVapidDetails(
    config.push.vapidSubject,
    config.push.vapidPublicKey,
    config.push.vapidPrivateKey
  );

  return {
    async send(subscription, payload) {
      try {
        const result = await webpush.sendNotification(
          subscription,
          JSON.stringify(payload)
        );
        return { statusCode: result.statusCode, body: result.body };
      } catch (err) {
        // 410 Gone or 404 Not Found → subscription is invalid
        if (err.statusCode === 410 || err.statusCode === 404) {
          const e = new Error('Push subscription is invalid');
          e.invalid = true;
          e.statusCode = err.statusCode;
          throw e;
        }
        throw err;
      }
    },
    isEnabled: () => true,
  };
}

export default initPush;