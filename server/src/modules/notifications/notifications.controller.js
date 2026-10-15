/**
 * SyncExc Server — Notifications controller
 */

import { success, created, paginated } from '../../lib/response.js';
import { serializeNotification } from '../../lib/serializers.js';

export function createNotificationsController(services) {
  const {
    notificationService,
    preferencesService,
    deviceService,
    deliveryService,
    eventRegistry,
    templateService,
    usageService,
  } = services;

  return {
    /* Notifications */
    async list(req, res) {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.pageSize ?? req.query.limit) || 25;
      const { rows, nextCursor, total } = await notificationService.list({
        userId: req.auth.userId,
        category: req.query.category,
        status: req.query.status,
        unreadOnly: req.query.status === 'unread' || req.query.unread === true || req.query.unread === 'true',
        readOnly: req.query.status === 'read',
        q: req.query.q,
        limit,
        offset: (page - 1) * limit,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeNotification), {
        nextCursor,
        limit,
        total,
      });
    },

    async unreadCount(req, res) {
      const count = await notificationService.countUnread({ userId: req.auth.userId });
      return success(res, { count });
    },

    async get(req, res) {
      const result = await notificationService.list({
        userId: req.auth.userId,
        limit: 1000,
      });
      const notification = result.rows.find((n) => n.id === req.params.notificationId);
      if (!notification) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found' } });
      return success(res, serializeNotification(notification));
    },

    async markRead(req, res) {
      const notification = await notificationService.markRead({
        userId: req.auth.userId,
        notificationId: req.params.notificationId,
      });
      return success(res, serializeNotification(notification));
    },

    async markAllRead(req, res) {
      const result = await notificationService.markAllRead({
        userId: req.auth.userId,
        category: req.body.category,
      });
      return success(res, result);
    },

    async archive(req, res) {
      const notification = await notificationService.archive({
        userId: req.auth.userId,
        notificationId: req.params.notificationId,
      });
      return success(res, serializeNotification(notification));
    },

    async getDeliveries(req, res) {
      const deliveries = await notificationService.getDeliveries({
        userId: req.auth.userId,
        notificationId: req.params.notificationId,
      });
      return success(res, deliveries);
    },

    /* Preferences */
    async getPreferences(req, res) {
      const result = await preferencesService.getPreferences({ userId: req.auth.userId });
      return success(res, result);
    },

    async setPreference(req, res) {
      const preference = await preferencesService.setPreference({
        userId: req.auth.userId,
        notificationType: req.body.notificationType,
        channel: req.body.channel,
        enabled: req.body.enabled,
      });
      return success(res, preference);
    },

    async setQuietHours(req, res) {
      const quiet = await preferencesService.setQuietHours({
        userId: req.auth.userId,
        enabled: req.body.enabled,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        timezone: req.body.timezone,
        daysOfWeek: req.body.daysOfWeek,
      });
      return success(res, quiet);
    },

    /* Devices */
    async listDevices(req, res) {
      const devices = await deviceService.listDevices({ userId: req.auth.userId });
      return success(res, devices);
    },

    async registerDevice(req, res) {
      const device = await deviceService.registerDevice({
        userId: req.auth.userId,
        endpoint: req.body.endpoint,
        keys: req.body.keys,
        deviceLabel: req.body.deviceLabel,
      });
      return created(res, device);
    },

    async removeDevice(req, res) {
      const result = await deviceService.removeDevice({
        userId: req.auth.userId,
        subscriptionId: req.params.subscriptionId,
      });
      return success(res, result);
    },

    /* Event types */
    async listEventTypes(req, res) {
      const events = eventRegistry.list();
      return success(res, events);
    },

    /* Templates (admin) */
    async listTemplates(req, res) {
      const templates = await templateService.listTemplates();
      return success(res, templates);
    },

    /* Operational metrics */
    async metrics(req, res) {
      const result = await req.services.db.query(
        `
        SELECT
          count(*) FILTER (WHERE status = 'created')::int AS pending,
          count(*) FILTER (WHERE status = 'delivered')::int AS delivered,
          count(*) FILTER (WHERE status = 'failed')::int AS failed
        FROM notifications
        WHERE created_at >= now() - interval '24 hours'
        `
      );
      return success(res, result.rows[0]);
    },
  };
}

export default createNotificationsController;