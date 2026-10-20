/**
 * SyncExc Server — Marketplace routes
 */

import { Router } from 'express';
import Joi from 'joi';
import {
  CreateProviderRequestSchema,
  PublishSignalRequestSchema,
  CreateCopyConfigurationRequestSchema,
  UuidSchema,
  PaginationSchema,
} from '@syncexc/shared';
import { createMarketplaceController } from './marketplace.controller.js';

const SubscribeSchema = Joi.object({
  planId: UuidSchema.optional(),
});

const CancelSignalSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required(),
});

const ModerationDecisionSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject', 'request_info', 'suspend').required(),
  reason: Joi.string().min(10).max(500).required(),
});

const ProviderQuerySchema = PaginationSchema.keys({
  q: Joi.string().trim().max(100).optional(),
  markets: Joi.string().trim().max(200).optional(),
});

const MySignalsQuerySchema = PaginationSchema.keys({
  status: Joi.string()
    .valid('draft', 'pending_validation', 'pending_review', 'published', 'updated', 'cancelled', 'expired', 'closed', 'rejected', 'withdrawn')
    .optional(),
});

const CreateProviderPlanSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  pricing: Joi.object({
    currency: Joi.string().valid('USD').required(),
    amountMinor: Joi.number().integer().min(0).max(100000000).required(),
    billingInterval: Joi.string().valid('monthly', 'yearly').required(),
  }).required(),
  entitlements: Joi.object({
    features: Joi.array().items(Joi.string().trim().min(1).max(120)).max(20).default([]),
  }).default({ features: [] }),
});

const UpdateProviderPlanSchema = Joi.object({
  status: Joi.string().valid('active', 'retired', 'archived').required(),
});

const UpdateProviderSchema = Joi.object({
  displayName: Joi.string().trim().min(1).max(120).optional(),
  biography: Joi.string().trim().max(4000).optional().allow(''),
  methodology: Joi.string().trim().max(4000).optional().allow(''),
  supportedMarkets: Joi.array().items(Joi.string().trim().max(32)).max(20).optional(),
  supportedLanguages: Joi.array().items(Joi.string().trim().max(8)).max(20).optional(),
  avatarUrl: Joi.string().uri({ scheme: ['https'] }).optional().allow(null),
  visibility: Joi.string().valid('private', 'public').optional(),
}).min(1);

export function createMarketplaceRoutes(services) {
  const controller = createMarketplaceController(services);
  const { middleware } = services;
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Provider discovery (public)
   * ------------------------------------------------------------------------ */
  router.get(
    '/providers',
    middleware.optionalAuth(),
    middleware.validateQuery(ProviderQuerySchema),
    middleware.asyncHandler(controller.listProviders)
  );

  router.get(
    '/providers/:providerId',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.getProvider)
  );

  router.get(
    '/providers/:providerId/signals',
    middleware.optionalAuth(),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listSignals)
  );

  router.get(
    '/providers/:providerId/plans',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.listProviderPlans)
  );

  router.get(
    '/providers/:providerId/performance',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.listPerformanceReports)
  );

  router.get(
    '/providers/:providerId/disclosures',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.listDisclosures)
  );

  /* ---------------------------------------------------------------------------
   * Provider self-management
   * ------------------------------------------------------------------------ */
  router.get(
    '/me/provider',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getMyProvider)
  );

  router.get(
    '/me/dashboard',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getMyDashboard)
  );

  router.get(
    '/me/subscribers',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listMySubscribers)
  );

  router.get(
    '/me/plans',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listMyPlans)
  );

  router.post(
    '/me/plans',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CreateProviderPlanSchema),
    middleware.asyncHandler(controller.createMyPlan)
  );

  router.patch(
    '/me/plans/:planId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateParams(Joi.object({ planId: UuidSchema.required() })),
    middleware.validateBody(UpdateProviderPlanSchema),
    middleware.asyncHandler(controller.updateMyPlan)
  );

  router.post(
    '/providers',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CreateProviderRequestSchema),
    middleware.asyncHandler(controller.createProvider)
  );

  router.patch(
    '/providers/:providerId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(UpdateProviderSchema),
    middleware.asyncHandler(controller.updateProvider)
  );

  router.post(
    '/me/signals',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(PublishSignalRequestSchema),
    middleware.asyncHandler(controller.publishSignal)
  );

  router.get(
    '/me/signals',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateQuery(MySignalsQuerySchema),
    middleware.asyncHandler(controller.listMySignals)
  );

  router.post(
    '/signals/:signalId/cancel',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CancelSignalSchema),
    middleware.asyncHandler(controller.cancelSignal)
  );

  /* ---------------------------------------------------------------------------
   * Follows
   * ------------------------------------------------------------------------ */
  router.post(
    '/providers/:providerId/follow',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.follow)
  );

  router.delete(
    '/providers/:providerId/follow',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.unfollow)
  );

  router.get(
    '/following',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listFollowing)
  );

  /* ---------------------------------------------------------------------------
   * Subscriptions
   * ------------------------------------------------------------------------ */
  router.post(
    '/providers/:providerId/subscribe',
    middleware.requireAuth(),
    middleware.validateBody(SubscribeSchema),
    middleware.asyncHandler(controller.subscribe)
  );

  router.post(
    '/subscriptions/:subscriptionId/cancel',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.cancelSubscription)
  );

  router.get(
    '/subscriptions',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listSubscriptions)
  );

  /* ---------------------------------------------------------------------------
   * Copy configurations
   * ------------------------------------------------------------------------ */
  router.get(
    '/copy-configurations',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listCopyConfigurations)
  );

  router.post(
    '/copy-configurations',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CreateCopyConfigurationRequestSchema),
    middleware.asyncHandler(controller.createCopyConfiguration)
  );

  router.get(
    '/copy-configurations/:configId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getCopyConfiguration)
  );

  router.post(
    '/copy-configurations/:configId/activate',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.activateCopyConfiguration)
  );

  router.post(
    '/copy-configurations/:configId/pause',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.pauseCopyConfiguration)
  );

  router.post(
    '/copy-configurations/:configId/revoke',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.revokeCopyConfiguration)
  );

  router.get(
    '/copy-results',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listCopyResults)
  );

  /* ---------------------------------------------------------------------------
   * Moderation
   * ------------------------------------------------------------------------ */
  router.get(
    '/moderation/cases',
    middleware.requireAuth(),
    middleware.requireAdmin(),
    middleware.asyncHandler(controller.listModerationCases)
  );

  router.post(
    '/moderation/cases/:caseId/decide',
    middleware.requireAuth(),
    middleware.requireAdmin(),
    middleware.validateBody(ModerationDecisionSchema),
    middleware.asyncHandler(controller.decideModeration)
  );

  /* ---------------------------------------------------------------------------
   * Disclosures
   * ------------------------------------------------------------------------ */
  router.post(
    '/disclosures/:disclosureId/accept',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.acceptDisclosure)
  );

  return router;
}

export default createMarketplaceRoutes;