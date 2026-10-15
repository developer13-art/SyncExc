/**
 * SyncExc Server — Device service (push subscriptions)
 */

import { NotFoundError } from '../../lib/errors.js';

export function createDeviceService({ db, queries, logger }) {
  async function registerDevice({ userId, endpoint, keys, deviceLabel }) {
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new Error('endpoint, keys.p256dh, and keys.auth are required');
    }

    // Validate endpoint
    if (!endpoint.startsWith('https://')) {
      throw new Error('Push endpoint must use HTTPS');
    }

    return db.tx(async (tx) => {
      return queries.insertPushSubscription(tx, {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        deviceLabel,
      });
    });
  }

  async function listDevices({ userId }) {
    return queries.listPushSubscriptions(userId);
  }

  async function removeDevice({ userId, subscriptionId }) {
    const ok = await queries.deletePushSubscription(subscriptionId, userId);
    if (!ok) throw new NotFoundError('Push subscription');
    return { ok: true };
  }

  async function markInvalid({ subscriptionId }) {
    await queries.updatePushSubscription(subscriptionId, { status: 'invalid' });
  }

  async function markUsed({ subscriptionId }) {
    await queries.updatePushSubscription(subscriptionId, { lastUsedAt: new Date() });
  }

  return {
    registerDevice,
    listDevices,
    removeDevice,
    markInvalid,
    markUsed,
  };
}

export default createDeviceService;