/**
 * SyncExc Server — Notification service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createNotificationService({ db, queries, deliveryService, events, realtime, logger }) {
  async function create({
    userId,
    eventId,
    eventType,
    category,
    priority,
    title,
    message,
    action,
    expiresAt,
  }) {
    if (!userId || !eventType || !category || !priority || !title || !message) {
      throw new Error('Missing required fields for notification');
    }

    const notification = await db.tx(async (tx) => {
      return queries.insertNotification(tx, {
        userId,
        eventId,
        eventType,
        category,
        priority,
        title,
        message,
        action,
        expiresAt,
      });
    });

    // Broadcast in real time for in-app notifications
    if (realtime) {
      realtime.broadcastToUser(userId, 'notification.created', {
        id: notification.id,
        eventType,
        category,
        priority,
        title,
        message,
        action: notification.action,
        createdAt: notification.created_at,
      });
    }

    return notification;
  }

  async function list({ userId, category, unreadOnly, limit, cursor }) {
    return queries.listNotificationsForUser(userId, {
      category,
      unreadOnly,
      limit,
      cursor,
    });
  }

  async function countUnread({ userId }) {
    return queries.countUnread(userId);
  }

  async function markRead({ userId, notificationId }) {
    const updated = await queries.markRead(notificationId, userId);
    if (!updated) throw new NotFoundError('Notification');
    return updated;
  }

  async function markAllRead({ userId, category }) {
    const count = await queries.markAllRead(userId, { category });
    return { marked: count };
  }

  async function archive({ userId, notificationId }) {
    const updated = await queries.archiveNotification(notificationId, userId);
    if (!updated) throw new NotFoundError('Notification');
    return updated;
  }

  async function getDeliveries({ userId, notificationId }) {
    const notification = await queries.findNotificationById(notificationId);
    if (!notification || notification.user_id !== userId) {
      throw new NotFoundError('Notification');
    }
    return queries.listDeliveriesForNotification(notificationId);
  }

  return {
    create,
    list,
    countUnread,
    markRead,
    markAllRead,
    archive,
    getDeliveries,
  };
}

export default createNotificationService;