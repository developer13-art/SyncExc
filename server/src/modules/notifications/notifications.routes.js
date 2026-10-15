/**
 * SyncExc Server — Notifications routes
 */

import { Router } from 'express';
import Joi from 'joi';
import { UuidSchema } from '@syncexc/shared';
import { createNotificationsController } from './notifications.controller.js';

const PreferenceSchema = Joi.object({
  notificationType: Joi.string().required(),
  channel: Joi.string().valid('in_app', 'email', 'push', 'webhook').required(),
  enabled: Joi.boolean().required(),
});

const QuietHoursSchema = Joi.object({
  enabled: Joi.boolean().required(),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  timezone: Joi.string().max(64).default('UTC'),
  daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).optional(),
});

const RegisterDeviceSchema = Joi.object({
  endpoint: Joi.string().uri({ scheme: ['https'] }).required(),
  keys: Joi.object({
    p256dh: Joi.string().required(),
    auth: Joi.string().required(),
  }).required(),
  deviceLabel: Joi.string().trim().max(120).optional(),
});

const MarkAllReadSchema = Joi.object({
  category: Joi.string().optional(),
});

const NotificationListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(25),
  limit: Joi.number().integer().min(1).max(100).optional(),
  cursor: Joi.string().isoDate().optional(),
  status: Joi.string().valid('read', 'unread').optional(),
  unread: Joi.boolean().optional(),
  category: Joi.string().max(100).optional(),
  q: Joi.string().trim().max(200).allow('').optional(),
});

export function createNotificationRoutes(services) {
  const controller = createNotificationsController(services);
  const { middleware } = services;
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Notifications
   * ------------------------------------------------------------------------ */
  router.get(
    '/',
    middleware.requireAuth(),
    middleware.validateQuery(NotificationListQuerySchema),
    middleware.asyncHandler(controller.list)
  );

  router.get(
    '/unread-count',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.unreadCount)
  );

  router.get(
    '/event-types',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listEventTypes)
  );

  router.get(
    '/:notificationId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.get)
  );

  router.patch(
    '/:notificationId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.markRead)
  );

  router.post(
    '/mark-all-read',
    middleware.requireAuth(),
    middleware.validateBody(MarkAllReadSchema),
    middleware.asyncHandler(controller.markAllRead)
  );

  router.post(
    '/:notificationId/archive',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.archive)
  );

  router.get(
    '/:notificationId/deliveries',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getDeliveries)
  );

  /* ---------------------------------------------------------------------------
   * Preferences
   * ------------------------------------------------------------------------ */
  router.get(
    '/preferences',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getPreferences)
  );

  router.patch(
    '/preferences',
    middleware.requireAuth(),
    middleware.validateBody(PreferenceSchema),
    middleware.asyncHandler(controller.setPreference)
  );

  router.put(
    '/preferences/quiet-hours',
    middleware.requireAuth(),
    middleware.validateBody(QuietHoursSchema),
    middleware.asyncHandler(controller.setQuietHours)
  );

  /* ---------------------------------------------------------------------------
   * Devices
   * ------------------------------------------------------------------------ */
  router.get(
    '/devices',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listDevices)
  );

  router.post(
    '/devices',
    middleware.requireAuth(),
    middleware.validateBody(RegisterDeviceSchema),
    middleware.asyncHandler(controller.registerDevice)
  );

  router.delete(
    '/devices/:subscriptionId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.removeDevice)
  );

  /* ---------------------------------------------------------------------------
   * Admin
   * ------------------------------------------------------------------------ */
  router.get(
    '/admin/templates',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listTemplates)
  );

  router.get(
    '/admin/metrics',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.metrics)
  );

  return router;
}

export default createNotificationRoutes;