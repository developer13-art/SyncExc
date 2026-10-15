/**
 * SyncExc Server — Deduplication service
 *
 * Uses a stable key built from (event type, recipient, resource, grouping
 * scope) to prevent duplicate notifications for the same logical event.
 */

import { createHash } from 'node:crypto';

export function createDeduplicationService({ db, queries, logger }) {
  function buildKey({ eventType, userId, workspaceId, resourceType, resourceId, customSuffix }) {
    const parts = [
      'ntf',
      eventType,
      userId || '',
      workspaceId || '',
      resourceType || '',
      resourceId || '',
      customSuffix || '',
    ];
    return createHash('sha256').update(parts.join('|')).digest('hex');
  }

  /**
   * Check whether a notification for this key has already been created.
   * Returns { duplicate: bool, existingNotificationId }.
   */
  async function check({ key }) {
    const existing = await queries.findDedupKey(key);
    if (existing) {
      return { duplicate: true, existingNotificationId: existing.notification_id };
    }
    return { duplicate: false };
  }

  /**
   * Record a deduplication key. Should be called after the notification is
   * created. If two workers race, one will win the unique constraint.
   */
  async function record({ key, notificationId }) {
    return db.tx(async (tx) => {
      const inserted = await queries.insertDedupKey(tx, {
        key,
        notificationId,
      });
      return inserted;
    });
  }

  return {
    buildKey,
    check,
    record,
  };
}

export default createDeduplicationService;