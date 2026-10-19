/**
 * SyncExc Server — Sources routes
 */

import { Router } from 'express';
import Joi from 'joi';
import {
  RegisterSourceRequestSchema,
  SubmitReviewDecisionRequestSchema,
  UuidSchema,
} from '@syncexc/shared';
import { createSourcesController } from './sources.controller.js';

const AuthorizeConnectionSchema = Joi.object({
  credentials: Joi.object().unknown(true).required(),
});

const TelegramSendCodeSchema = Joi.object({
  phoneNumber: Joi.string().trim().max(16).required(),
});

const TelegramVerifyCodeSchema = Joi.object({
  loginId: UuidSchema.required(),
  code: Joi.string().trim().max(8).optional(),
  password: Joi.string().max(256).optional(),
});

const TelegramLoginSchema = Joi.object({
  loginId: UuidSchema.required(),
});

const TelegramCreateSourcesSchema = Joi.object({
  loginId: UuidSchema.required(),
  channelIds: Joi.array()
    .items(
      Joi.string()
        .max(64)
        .pattern(/^(channel|chat):\d+$/),
    )
    .min(1)
    .max(50)
    .unique()
    .required(),
});

const SandboxSchema = Joi.object({
  sampleSize: Joi.number().integer().min(1).max(100).default(10),
});

const MonitoringSchema = Joi.object({
  enabled: Joi.boolean().required(),
});

const ExecutionConfigSchema = Joi.object({
  mode: Joi.string().valid('monitor_only', 'review', 'simulate', 'live').required(),
  settings: Joi.object({
    maxLeverage: Joi.number().integer().min(1).max(20).optional(),
    riskPerTradePct: Joi.number().positive().max(5).optional(),
    maxNotional: Joi.number().positive().optional(),
    allowMarketOrders: Joi.boolean().optional(),
    allowedSymbols: Joi.array()
      .items(Joi.string().trim().uppercase().max(32))
      .max(100)
      .unique()
      .optional(),
  }).default({}),
  destinationAccountIds: Joi.array().items(UuidSchema).max(10).unique().default([]),
});

export function createSourcesRoutes(services) {
  const controller = createSourcesController(services);
  const { middleware } = services;
  const router = Router();

  router.post(
    '/telegram/login/code',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(TelegramSendCodeSchema),
    middleware.asyncHandler(controller.telegramSendCode),
  );

  router.post(
    '/telegram/login/verify',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(TelegramVerifyCodeSchema),
    middleware.asyncHandler(controller.telegramVerifyCode),
  );

  router.post(
    '/telegram/login/channels',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(TelegramLoginSchema),
    middleware.asyncHandler(controller.telegramListChannels),
  );

  router.post(
    '/telegram/login/sources',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(TelegramCreateSourcesSchema),
    middleware.asyncHandler(controller.telegramCreateSources),
  );

  router.delete(
    '/telegram/login',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(TelegramLoginSchema),
    middleware.asyncHandler(controller.telegramCancelLogin),
  );

  /* ---------------------------------------------------------------------------
   * Sources
   * ------------------------------------------------------------------------ */
  router.get(
    '/categories',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listCategories),
  );

  router.get(
    '/',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.list),
  );

  router.post(
    '/',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(RegisterSourceRequestSchema),
    middleware.asyncHandler(controller.create),
  );

  router.get(
    '/:sourceId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateParams(Joi.object({ sourceId: UuidSchema.required() })),
    middleware.asyncHandler(controller.get),
  );

  router.patch(
    '/:sourceId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.update),
  );

  router.get(
    '/:sourceId/connection',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getConnection),
  );

  router.post(
    '/:sourceId/activate',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.activate),
  );

  router.post(
    '/:sourceId/pause',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.pause),
  );

  router.post(
    '/:sourceId/archive',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.archive),
  );

  router.put(
    '/:sourceId/monitoring',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(MonitoringSchema),
    middleware.asyncHandler(controller.setMonitoring),
  );

  router.get(
    '/:sourceId/execution-config',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getExecutionConfig),
  );

  router.put(
    '/:sourceId/execution-config',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(ExecutionConfigSchema),
    middleware.asyncHandler(controller.updateExecutionConfig),
  );

  /* ---------------------------------------------------------------------------
   * Connection
   * ------------------------------------------------------------------------ */
  router.post(
    '/:sourceId/connection/authorize',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(AuthorizeConnectionSchema),
    middleware.asyncHandler(controller.authorizeConnection),
  );

  router.post(
    '/:sourceId/connection/test',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.testConnection),
  );

  router.delete(
    '/:sourceId/connection',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.disconnectConnection),
  );

  /* ---------------------------------------------------------------------------
   * Validation, health, quality, sandbox
   * ------------------------------------------------------------------------ */
  router.post(
    '/:sourceId/validate',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.runValidation),
  );

  router.get(
    '/:sourceId/validations',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listValidations),
  );

  router.get(
    '/:sourceId/health',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getHealth),
  );

  router.post(
    '/:sourceId/health/check',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.checkHealth),
  );

  router.get(
    '/:sourceId/quality',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getQuality),
  );

  router.post(
    '/:sourceId/sandbox',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(SandboxSchema),
    middleware.asyncHandler(controller.runSandbox),
  );

  /* ---------------------------------------------------------------------------
   * Reviews
   * ------------------------------------------------------------------------ */
  router.post(
    '/reviews',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(SubmitReviewDecisionRequestSchema),
    middleware.asyncHandler(controller.submitReview),
  );

  return router;
}

export default createSourcesRoutes;
