/**
 * SyncExc Server — Marketplace routes
 */

import { Router } from 'express';
import multer from 'multer';
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

const CopySignalSchema = Joi.object({
  configurationId: UuidSchema.required(),
  destinationAccountIds: Joi.array().items(UuidSchema).min(1).unique().required(),
  amount: Joi.string().trim().pattern(/^\d+(?:\.\d+)?$/).required(),
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

const StrategyQuerySchema = PaginationSchema.keys({
  q: Joi.string().trim().max(100).optional(),
  category: Joi.string().trim().max(64).optional(),
  market: Joi.string().trim().max(32).optional(),
  providerId: UuidSchema.optional(),
});

const CreateStrategySchema = Joi.object({
  workflowId: UuidSchema.required(),
  workflowVersionId: UuidSchema.required(),
  providerPlanId: UuidSchema.optional(),
  name: Joi.string().trim().min(1).max(100).required(),
  category: Joi.string().trim().min(1).max(64).required(),
  description: Joi.string().trim().min(1).max(4000).required(),
  supportedMarkets: Joi.array().items(Joi.string().trim().max(32)).min(1).max(10).required(),
});

const UpdateStrategySchema = Joi.object({
  status: Joi.string().valid('paused', 'archived').required(),
});

const CreateStrategyDeploymentSchema = Joi.object({
  connectionId: UuidSchema.required(),
  accountId: UuidSchema.required(),
  allocationAmount: Joi.number().greater(0).precision(12).required(),
  maxOpenPositions: Joi.number().integer().min(1).max(100).default(1),
  maxDrawdownPercent: Joi.number().greater(0).less(100).precision(3).default(10),
  dailyLossLimitPercent: Joi.number().greater(0).less(100).precision(3).default(5),
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
  autoPublishTrades: Joi.boolean().optional(),
}).min(1);

const StripeCountrySchema = Joi.object({
  country: Joi.string().uppercase().pattern(/^[A-Z]{2}$/).required(),
});

const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const winningsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

export function createMarketplaceRoutes(services) {
  const controller = createMarketplaceController(services);
  const { middleware } = services;
  const router = Router();

  router.post(
    '/webhooks/stripe',
    middleware.verifyStripeSignature(),
    middleware.asyncHandler(controller.handleStripeWebhook)
  );

  router.post(
    '/webhooks/stripe-connect',
    middleware.verifyStripeSignature({ connectAccount: true }),
    middleware.asyncHandler(controller.handleStripeWebhook)
  );

  router.get(
    '/signals/:signalId/comments',
    middleware.requireAuth(),
    middleware.validateParams(Joi.object({ signalId: UuidSchema.required() })),
    middleware.asyncHandler(controller.listSignalComments)
  );

  router.post(
    '/signals/:signalId/copy',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requireAnyPermission('trading.request_execution', 'trading.approve_execution'),
    middleware.validateParams(Joi.object({ signalId: UuidSchema.required() })),
    middleware.validateBody(CopySignalSchema),
    middleware.asyncHandler(controller.copySignal)
  );

  router.post(
    '/signals/:signalId/comments',
    middleware.requireAuth(),
    middleware.validateParams(Joi.object({ signalId: UuidSchema.required() })),
    winningsUpload.single('proof'),
    middleware.validateBody(Joi.object({
      content: Joi.string().trim().max(5000).allow('').default(''),
    })),
    middleware.asyncHandler(controller.createSignalComment)
  );

  router.get(
    '/signal-comments/:commentId/proof',
    middleware.requireAuth(),
    middleware.validateParams(Joi.object({ commentId: UuidSchema.required() })),
    middleware.asyncHandler(controller.getSignalCommentProof)
  );

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
   * Strategy discovery and execution
   * ------------------------------------------------------------------------ */
  router.get(
    '/strategies',
    middleware.optionalAuth(),
    middleware.validateQuery(StrategyQuerySchema),
    middleware.asyncHandler(controller.listStrategies)
  );

  router.get(
    '/strategies/follows',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listFollowedStrategies)
  );

  router.get(
    '/strategies/:strategyId',
    middleware.optionalAuth(),
    middleware.validateParams(Joi.object({ strategyId: UuidSchema.required() })),
    middleware.asyncHandler(controller.getStrategy)
  );

  router.post(
    '/strategies/:strategyId/follow',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateParams(Joi.object({ strategyId: UuidSchema.required() })),
    middleware.asyncHandler(controller.followStrategy)
  );

  router.delete(
    '/strategies/:strategyId/follow',
    middleware.requireAuth(),
    middleware.validateParams(Joi.object({ strategyId: UuidSchema.required() })),
    middleware.asyncHandler(controller.unfollowStrategy)
  );

  router.post(
    '/strategies/:strategyId/deploy',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.request_execution'),
    middleware.validateParams(Joi.object({ strategyId: UuidSchema.required() })),
    middleware.validateBody(CreateStrategyDeploymentSchema),
    middleware.asyncHandler(controller.createStrategyDeployment)
  );

  router.get(
    '/me/strategies',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listMyStrategies)
  );

  router.post(
    '/me/strategies',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CreateStrategySchema),
    middleware.asyncHandler(controller.createMyStrategy)
  );

  router.patch(
    '/me/strategies/:strategyId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateParams(Joi.object({ strategyId: UuidSchema.required() })),
    middleware.validateBody(UpdateStrategySchema),
    middleware.asyncHandler(controller.updateMyStrategyStatus)
  );

  router.get(
    '/me/strategy-deployments',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listMyStrategyDeployments)
  );

  router.post(
    '/me/strategy-deployments/:deploymentId/activate',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.request_execution'),
    middleware.validateParams(Joi.object({ deploymentId: UuidSchema.required() })),
    middleware.asyncHandler(controller.activateStrategyDeployment)
  );

  router.post(
    '/me/strategy-deployments/:deploymentId/pause',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateParams(Joi.object({ deploymentId: UuidSchema.required() })),
    middleware.asyncHandler(controller.pauseStrategyDeployment)
  );

  router.post(
    '/me/strategy-deployments/:deploymentId/stop',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateParams(Joi.object({ deploymentId: UuidSchema.required() })),
    middleware.asyncHandler(controller.stopStrategyDeployment)
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

  router.get(
    '/me/payout-account',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getPayoutStatus)
  );

  router.post(
    '/me/payout-account/onboarding',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(StripeCountrySchema),
    middleware.asyncHandler(controller.startPayoutOnboarding)
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
    '/providers/:providerId/cover',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateParams(Joi.object({ providerId: UuidSchema.required() })),
    coverUpload.single('cover'),
    middleware.asyncHandler(controller.uploadProviderCover),
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
    '/me/signals/preflight',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(PublishSignalRequestSchema),
    middleware.asyncHandler(controller.preflightSignal)
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

  const listFollowingRoute = [
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listFollowing),
  ];
  router.get('/following', ...listFollowingRoute);
  router.get('/follows', ...listFollowingRoute);

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

  router.post(
    '/copy-results/:recordId/confirm',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requireAnyPermission('trading.request_execution', 'trading.approve_execution'),
    middleware.validateParams(Joi.object({ recordId: UuidSchema.required() })),
    middleware.asyncHandler(controller.confirmCopyResult)
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