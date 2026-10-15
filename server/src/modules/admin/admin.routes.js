/**
 * SyncExc Server — Admin routes
 *
 * Every route requires the admin role via the requireAdmin middleware,
 * then checks a specific permission.
 */

import { Router } from 'express';
import Joi from 'joi';
import { UuidSchema, PaginationSchema } from '@syncexc/shared';
import { createAdminController } from './admin.controller.js';
import { createAdminAuthRoutes } from './admin-auth.routes.js';

const SuspendUserSchema = Joi.object({
  reason: Joi.string().min(10).max(1000).required(),
  scope: Joi.string().valid('full', 'sign_in_only', 'specific_actions').required(),
  durationHours: Joi.number().integer().min(1).max(8760).optional(),
});

const RestoreUserSchema = Joi.object({
  reason: Joi.string().min(10).max(1000).required(),
});

const ReasonSchema = Joi.object({
  reason: Joi.string().min(10).max(1000).required(),
});

const CreatePlanSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_]{3,32}$/).required(),
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(2000).optional(),
  features: Joi.object().unknown(true).required(),
  limits: Joi.object().unknown(true).required(),
  prices: Joi.array().items(
    Joi.object({
      currency: Joi.string().uppercase().length(3).required(),
      amountMinor: Joi.number().integer().min(0).required(),
      billingInterval: Joi.string().valid('monthly', 'yearly').required(),
    })
  ).min(1).required(),
});

const UpdatePlanSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(2000).allow('').optional(),
  features: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim().min(1).max(100)),
    Joi.object().unknown(true)
  ).optional(),
}).min(1);

const CreatePlanVersionSchema = Joi.object({
  features: Joi.object().unknown(true).required(),
  limits: Joi.object().unknown(true).required(),
  prices: Joi.array().items(
    Joi.object({
      currency: Joi.string().uppercase().length(3).required(),
      amountMinor: Joi.number().integer().min(0).required(),
      billingInterval: Joi.string().valid('monthly', 'yearly').required(),
    })
  ).default([]),
  effectiveFrom: Joi.date().iso().optional(),
});

const ApplyCreditSchema = Joi.object({
  amountMinor: Joi.number().integer().positive().required(),
  currency: Joi.string().uppercase().length(3).required(),
  reason: Joi.string().min(10).max(500).required(),
});

const InitiateRefundSchema = Joi.object({
  paymentId: UuidSchema.required(),
  amountMinor: Joi.number().integer().positive().required(),
  currency: Joi.string().uppercase().length(3).required(),
  reason: Joi.string().min(10).max(1000).required(),
});

const RestrictExchangeSchema = Joi.object({
  capabilityKey: Joi.string().required(),
  reason: Joi.string().min(10).max(500).required(),
  expiresAt: Joi.date().iso().optional(),
});

const SourceCandidateDecisionSchema = Joi.object({
  decision: Joi.string().valid('approve', 'reject', 'request_information', 'suspend').required(),
  reason: Joi.string().min(10).max(2000).required(),
  scope: Joi.string().optional(),
});

export const SourceCandidateQuerySchema = PaginationSchema.keys({
  status: Joi.string().valid(
    'new',
    'pending_review',
    'under_review',
    'approved_for_validation',
    'validation_in_progress',
    'approved',
    'rejected',
    'additional_information_required',
    'suspended',
    'archived',
  ).optional(),
  q: Joi.string().trim().max(200).optional(),
});

const SignalSourceActionSchema = Joi.object({
  action: Joi.string().valid('pause', 'suspend', 'restore', 'archive').required(),
  reason: Joi.string().min(10).max(1000).required(),
  scope: Joi.string().optional(),
});

const CreateReferralPolicySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  config: Joi.object().unknown(true).required(),
  effectiveFrom: Joi.date().iso().optional(),
});

const ReviewPayoutSchema = Joi.object({
  decision: Joi.string().valid('approve', 'reject').required(),
  reason: Joi.string().min(10).max(500).required(),
});

const FraudCaseDecisionSchema = Joi.object({
  decision: Joi.string().valid('cleared', 'confirmed_abuse', 'restricted', 'closed').required(),
  reason: Joi.string().min(10).max(500).required(),
});

const CreateFeatureFlagSchema = Joi.object({
  key: Joi.string().trim().pattern(/^[a-z][a-z0-9_]{2,63}$/).required(),
  description: Joi.string().trim().min(10).max(500).required(),
  owningTeam: Joi.string().trim().max(64).required(),
  relatedModule: Joi.string().trim().max(64).required(),
  type: Joi.string().valid('release', 'operational_control', 'experiment', 'emergency_kill_switch').required(),
  defaultValue: Joi.boolean().default(false),
  environment: Joi.string().valid('development', 'staging', 'production').required(),
  targetingRules: Joi.array().items(Joi.object().unknown(true)).optional(),
  expiresAt: Joi.date().iso().optional(),
});

const RolloutSchema = Joi.object({
  targetPercentage: Joi.number().integer().min(0).max(100).required(),
  targetRules: Joi.array().items(Joi.object().unknown(true)).optional(),
  environment: Joi.string().valid('development', 'staging', 'production').required(),
  reason: Joi.string().min(10).max(500).required(),
});

const CreateRoleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(500).required(),
  permissions: Joi.array().items(Joi.string()).min(1).required(),
});

const AssignRoleSchema = Joi.object({
  userId: UuidSchema.required(),
  roleId: UuidSchema.required(),
  scopeType: Joi.string().max(32).optional(),
  scopeId: UuidSchema.optional(),
});

const ApprovalDecisionSchema = Joi.object({
  decision: Joi.string().valid('approved', 'rejected').required(),
  reason: Joi.string().max(1000).optional(),
});

const CreateAlertRuleSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  metricKey: Joi.string().min(1).max(100).required(),
  threshold: Joi.number().required(),
  comparison: Joi.string().valid('gt', 'gte', 'lt', 'lte', 'eq').required(),
  severity: Joi.string().valid('info', 'warning', 'high', 'critical').required(),
});

const ExportSchema = Joi.object({
  resourceType: Joi.string().valid('audit_events', 'users', 'payments').required(),
  filters: Joi.object().unknown(true).optional(),
  reason: Joi.string().min(10).max(500).required(),
});

export function createAdminRoutes(services) {
  const controller = createAdminController(services);
  const { middleware } = services;
  const router = Router();

  router.use(
    '/auth',
    createAdminAuthRoutes({
      identity: services.identity,
      permission: services.adminPermissionService,
      middleware,
    })
  );

  // Every admin route requires admin authentication
  router.use(middleware.requireAuth());
  router.use(middleware.requireAdmin());

  /* Dashboard */
  router.get(
    '/dashboard',
    middleware.requireAdminPermission('admin.dashboard.view'),
    middleware.asyncHandler(controller.getOverview)
  );
  router.get(
    '/health',
    middleware.requireAdminPermission('admin.metrics.view'),
    middleware.asyncHandler(controller.getHealth)
  );

  /* Users */
  router.get(
    '/users',
    middleware.requireAdminPermission('admin.users.view'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.searchUsers)
  );

  router.get(
    '/users/:userId',
    middleware.requireAdminPermission('admin.users.view'),
    middleware.asyncHandler(controller.getUser)
  );

  router.get(
    '/users/:userId/audit',
    middleware.requireAdminPermission('admin.audit.view'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.searchUserAudit)
  );

  router.post(
    '/users/:userId/suspend',
    middleware.requireAdminPermission('admin.users.suspend'),
    middleware.requireStepUp(),
    middleware.validateBody(SuspendUserSchema),
    middleware.asyncHandler(controller.suspendUser)
  );

  router.post(
    '/users/:userId/restore',
    middleware.requireAdminPermission('admin.users.restore'),
    middleware.validateBody(RestoreUserSchema),
    middleware.asyncHandler(controller.restoreUser)
  );

  router.post(
    '/users/:userId/revoke-sessions',
    middleware.requireAdminPermission('admin.users.sessions.revoke'),
    middleware.validateBody(ReasonSchema),
    middleware.asyncHandler(controller.revokeUserSessions)
  );

  router.post(
    '/users/:userId/mfa-reset',
    middleware.requireAdminPermission('admin.users.mfa.reset'),
    middleware.requireStepUp(),
    middleware.validateBody(ReasonSchema),
    middleware.asyncHandler(controller.requireMfaReset)
  );

  /* Workspaces */
  router.get(
    '/workspaces',
    middleware.requireAdminPermission('admin.workspaces.view'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.searchWorkspaces)
  );

  router.get(
    '/workspaces/:workspaceId',
    middleware.requireAdminPermission('admin.workspaces.view'),
    middleware.asyncHandler(controller.getWorkspace)
  );

  router.post(
    '/workspaces/:workspaceId/suspend',
    middleware.requireAdminPermission('admin.workspaces.manage'),
    middleware.validateBody(ReasonSchema),
    middleware.asyncHandler(controller.suspendWorkspace)
  );

  router.post(
    '/workspaces/:workspaceId/restore',
    middleware.requireAdminPermission('admin.workspaces.manage'),
    middleware.validateBody(ReasonSchema),
    middleware.asyncHandler(controller.restoreWorkspace)
  );

  router.post(
    '/connection-shares/:grantId/revoke',
    middleware.requireAdminPermission('admin.workspaces.shares.manage'),
    middleware.validateBody(ReasonSchema),
    middleware.asyncHandler(controller.revokeShareGrant)
  );

  /* Plans */
  router.get(
    '/plans',
    middleware.requireAdminPermission('admin.plans.view'),
    middleware.asyncHandler(controller.listPlans)
  );

  router.get(
    '/plans/:planId',
    middleware.requireAdminPermission('admin.plans.view'),
    middleware.asyncHandler(controller.getPlan)
  );

  router.post(
    '/plans',
    middleware.requireAdminPermission('admin.plans.manage'),
    middleware.validateBody(CreatePlanSchema),
    middleware.asyncHandler(controller.createPlan)
  );

  router.patch(
    '/plans/:planId',
    middleware.requireAdminPermission('admin.plans.manage'),
    middleware.validateBody(UpdatePlanSchema),
    middleware.asyncHandler(controller.updatePlan)
  );

  router.post(
    '/plans/:planId/publish',
    middleware.requireAdminPermission('admin.plans.manage'),
    middleware.asyncHandler(controller.publishPlan)
  );

  router.post(
    '/plans/:planId/retire',
    middleware.requireAdminPermission('admin.plans.manage'),
    middleware.validateBody(ReasonSchema),
    middleware.asyncHandler(controller.retirePlan)
  );

  router.post(
    '/plans/:planId/versions',
    middleware.requireAdminPermission('admin.plans.manage'),
    middleware.validateBody(CreatePlanVersionSchema),
    middleware.asyncHandler(controller.createPlanVersion)
  );

  /* Subscriptions */
  router.get(
    '/subscriptions',
    middleware.requireAdminPermission('admin.subscriptions.view'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.searchSubscriptions)
  );

  router.get(
    '/subscriptions/:subscriptionId',
    middleware.requireAdminPermission('admin.subscriptions.view'),
    middleware.asyncHandler(controller.getSubscription)
  );

  router.post(
    '/subscriptions/:subscriptionId/apply-credit',
    middleware.requireAdminPermission('admin.subscriptions.manage'),
    middleware.validateBody(ApplyCreditSchema),
    middleware.asyncHandler(controller.applyCredit)
  );

  /* Payments */
  router.get(
    '/payments',
    middleware.requireAdminPermission('admin.payments.view'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.searchPayments)
  );

  router.get(
    '/payments/:paymentId',
    middleware.requireAdminPermission('admin.payments.view'),
    middleware.asyncHandler(controller.getPayment)
  );

  /* Refunds */
  router.get(
    '/refunds',
    middleware.requireAdminPermission('admin.payments.view'),
    middleware.asyncHandler(controller.listRefunds)
  );

  router.post(
    '/refunds',
    middleware.requireAdminPermission('admin.refunds.initiate'),
    middleware.requireStepUp(),
    middleware.validateBody(InitiateRefundSchema),
    middleware.asyncHandler(controller.initiateRefund)
  );

  router.get(
    '/refunds/:refundId',
    middleware.requireAdminPermission('admin.payments.view'),
    middleware.asyncHandler(controller.getRefund)
  );

  /* Exchanges */
  router.get(
    '/exchanges',
    middleware.requireAdminPermission('admin.exchanges.view'),
    middleware.asyncHandler(controller.listExchanges)
  );

  router.get(
    '/exchanges/:exchangeCode/health',
    middleware.requireAdminPermission('admin.exchanges.view'),
    middleware.asyncHandler(controller.getExchangeHealth)
  );

  router.post(
    '/exchanges/:exchangeCode/restrict',
    middleware.requireAdminPermission('admin.exchanges.restrict'),
    middleware.validateBody(RestrictExchangeSchema),
    middleware.asyncHandler(controller.restrictCapability)
  );

  /* Source review */
  router.get(
    '/source-discovery/candidates',
    middleware.requireAdminPermission('admin.sources.review'),
    middleware.validateQuery(SourceCandidateQuerySchema),
    middleware.asyncHandler(controller.listSourceCandidates)
  );

  router.get(
    '/source-discovery/candidates/:candidateId',
    middleware.requireAdminPermission('admin.sources.review'),
    middleware.asyncHandler(controller.getSourceCandidate)
  );

  router.post(
    '/source-discovery/candidates/:candidateId/decisions',
    middleware.requireAdminPermission('admin.sources.review'),
    middleware.validateBody(SourceCandidateDecisionSchema),
    middleware.asyncHandler(controller.decideSourceCandidate)
  );

  /* Signal sources */
  router.get(
    '/signal-sources',
    middleware.requireAdminPermission('admin.sources.manage'),
    middleware.asyncHandler(controller.listSignalSources)
  );

  router.get(
    '/signal-sources/:sourceId',
    middleware.requireAdminPermission('admin.sources.manage'),
    middleware.asyncHandler(controller.getSignalSource)
  );

  router.post(
    '/signal-sources/:sourceId/actions',
    middleware.requireAdminPermission('admin.sources.manage'),
    middleware.validateBody(SignalSourceActionSchema),
    middleware.asyncHandler(controller.signalSourceAction)
  );

  /* Referral */
  router.get(
    '/referral/policies',
    middleware.requireAdminPermission('admin.referral.policies.manage'),
    middleware.asyncHandler(controller.listReferralPolicies)
  );

  router.get(
    '/referrals/policies',
    middleware.requireAdminPermission('admin.referral.policies.manage'),
    middleware.asyncHandler(controller.listReferralPolicies)
  );

  router.post(
    '/referral/policies',
    middleware.requireAdminPermission('admin.referral.policies.manage'),
    middleware.validateBody(CreateReferralPolicySchema),
    middleware.asyncHandler(controller.createReferralPolicy)
  );

  router.post(
    '/referrals/policies',
    middleware.requireAdminPermission('admin.referral.policies.manage'),
    middleware.validateBody(CreateReferralPolicySchema),
    middleware.asyncHandler(controller.createReferralPolicy)
  );

  router.post(
    '/referral/policies/:policyId/publish',
    middleware.requireAdminPermission('admin.referral.policies.manage'),
    middleware.validateBody(ReasonSchema),
    middleware.asyncHandler(controller.publishReferralPolicy)
  );

  router.post(
    '/referrals/policies/:policyId/publish',
    middleware.requireAdminPermission('admin.referral.policies.manage'),
    middleware.validateBody(ReasonSchema),
    middleware.asyncHandler(controller.publishReferralPolicy)
  );

  router.get(
    '/referral/payouts',
    middleware.requireAdminPermission('admin.referral.payouts.review'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listPayouts)
  );

  router.get(
    '/referrals/payouts',
    middleware.requireAdminPermission('admin.referral.payouts.review'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listPayouts)
  );

  router.get(
    '/referrals/commissions',
    middleware.requireAdminPermission('admin.referral.commissions.view'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listCommissions)
  );

  router.post(
    '/referral/payouts/:payoutId/review',
    middleware.requireAdminPermission('admin.referral.payouts.review'),
    middleware.validateBody(ReviewPayoutSchema),
    middleware.asyncHandler(controller.reviewPayout)
  );

  router.get(
    '/referral/fraud-cases',
    middleware.requireAdminPermission('admin.referral.fraud.review'),
    middleware.asyncHandler(controller.listFraudCases)
  );

  router.get(
    '/referrals/fraud-cases',
    middleware.requireAdminPermission('admin.referral.fraud.review'),
    middleware.asyncHandler(controller.listFraudCases)
  );

  router.post(
    '/referral/fraud-cases/:caseId/decide',
    middleware.requireAdminPermission('admin.referral.fraud.review'),
    middleware.validateBody(FraudCaseDecisionSchema),
    middleware.asyncHandler(controller.decideFraudCase)
  );

  router.post(
    '/referrals/fraud-cases/:caseId/decisions',
    middleware.requireAdminPermission('admin.referral.fraud.review'),
    middleware.validateBody(FraudCaseDecisionSchema),
    middleware.asyncHandler(controller.decideFraudCase)
  );

  /* Support */
  router.get(
    '/support/queues',
    middleware.requireAdminPermission('admin.support.view'),
    middleware.asyncHandler(controller.listSupportQueues)
  );

  router.get(
    '/support/queues/:queueId/members',
    middleware.requireAdminPermission('admin.support.view'),
    middleware.asyncHandler(controller.listQueueMembers)
  );

  router.post(
    '/support/queues/:queueId/members',
    middleware.requireAdminPermission('admin.support.manage'),
    middleware.asyncHandler(controller.addQueueMember)
  );

  router.delete(
    '/support/queues/:queueId/members/:userId',
    middleware.requireAdminPermission('admin.support.manage'),
    middleware.asyncHandler(controller.removeQueueMember)
  );

  router.get(
    '/support/metrics',
    middleware.requireAdminPermission('admin.support.view'),
    middleware.asyncHandler(controller.getSupportMetrics)
  );

  /* Feature flags */
  router.get(
    '/feature-flags',
    middleware.requireAdminPermission('admin.feature_flags.view'),
    middleware.asyncHandler(controller.listFeatureFlags)
  );

  router.post(
    '/feature-flags',
    middleware.requireAdminPermission('admin.feature_flags.manage'),
    middleware.validateBody(CreateFeatureFlagSchema),
    middleware.asyncHandler(controller.createFeatureFlag)
  );

  router.get(
    '/feature-flags/:flagId',
    middleware.requireAdminPermission('admin.feature_flags.view'),
    middleware.asyncHandler(controller.getFeatureFlag)
  );

  router.patch(
    '/feature-flags/:flagId',
    middleware.requireAdminPermission('admin.feature_flags.manage'),
    middleware.asyncHandler(controller.updateFeatureFlag)
  );

  router.post(
    '/feature-flags/:flagId/rollouts',
    middleware.requireAdminPermission('admin.feature_flags.rollout'),
    middleware.validateBody(RolloutSchema),
    middleware.asyncHandler(controller.initiateRollout)
  );

  router.post(
    '/feature-flags/:flagId/rollback',
    middleware.requireAdminPermission('admin.feature_flags.rollback'),
    middleware.validateBody(ReasonSchema),
    middleware.asyncHandler(controller.rollbackFeatureFlag)
  );

  /* Roles & permissions */
  router.get(
    '/roles',
    middleware.requireAdminPermission('admin.roles.view'),
    middleware.asyncHandler(controller.listRoles)
  );

  router.post(
    '/roles',
    middleware.requireAdminPermission('admin.roles.manage'),
    middleware.validateBody(CreateRoleSchema),
    middleware.asyncHandler(controller.createRole)
  );

  router.patch(
    '/roles/:roleId',
    middleware.requireAdminPermission('admin.roles.manage'),
    middleware.asyncHandler(controller.updateRole)
  );

  router.post(
    '/roles/assign',
    middleware.requireAdminPermission('admin.roles.manage'),
    middleware.requireStepUp(),
    middleware.validateBody(AssignRoleSchema),
    middleware.asyncHandler(controller.assignRole)
  );

  router.delete(
    '/role-assignments/:assignmentId',
    middleware.requireAdminPermission('admin.roles.manage'),
    middleware.asyncHandler(controller.revokeRole)
  );

  router.get(
    '/permissions',
    middleware.requireAdminPermission('admin.permissions.view'),
    middleware.asyncHandler(controller.listPermissions)
  );

  router.get(
    '/users/:userId/role-assignments',
    middleware.requireAdminPermission('admin.roles.view'),
    middleware.asyncHandler(controller.listRoleAssignments)
  );

  /* Approvals */
  router.get(
    '/approvals',
    middleware.requireAdminPermission('admin.approvals.view'),
    middleware.asyncHandler(controller.listApprovals)
  );

  router.post(
    '/approvals/:approvalId/decide',
    middleware.requireAdminPermission('admin.approvals.decide'),
    middleware.validateBody(ApprovalDecisionSchema),
    middleware.asyncHandler(controller.decideApproval)
  );

  /* Audit */
  router.get(
    '/audit-events',
    middleware.requireAdminPermission('admin.audit.view'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.searchAudit)
  );

  /* Alerts */
  router.get(
    '/alert-rules',
    middleware.requireAdminPermission('admin.alerts.manage'),
    middleware.asyncHandler(controller.listAlertRules)
  );

  router.post(
    '/alert-rules',
    middleware.requireAdminPermission('admin.alerts.manage'),
    middleware.validateBody(CreateAlertRuleSchema),
    middleware.asyncHandler(controller.createAlertRule)
  );

  router.patch(
    '/alert-rules/:ruleId',
    middleware.requireAdminPermission('admin.alerts.manage'),
    middleware.asyncHandler(controller.updateAlertRule)
  );

  router.get(
    '/alert-events',
    middleware.requireAdminPermission('admin.alerts.manage'),
    middleware.asyncHandler(controller.listAlertEvents)
  );

  router.post(
    '/alert-events/:alertId/acknowledge',
    middleware.requireAdminPermission('admin.alerts.manage'),
    middleware.asyncHandler(controller.acknowledgeAlert)
  );

  router.post(
    '/alert-events/:alertId/resolve',
    middleware.requireAdminPermission('admin.alerts.manage'),
    middleware.asyncHandler(controller.resolveAlert)
  );

  /* Operation jobs */
  router.get(
    '/operation-jobs',
    middleware.requireAdminPermission('admin.jobs.view'),
    middleware.asyncHandler(controller.listOperationJobs)
  );

  router.get(
    '/operation-jobs/:jobId',
    middleware.requireAdminPermission('admin.jobs.view'),
    middleware.asyncHandler(controller.getOperationJob)
  );

  router.post(
    '/operation-jobs/:jobId/cancel',
    middleware.requireAdminPermission('admin.jobs.manage'),
    middleware.validateBody(ReasonSchema),
    middleware.asyncHandler(controller.cancelOperationJob)
  );

  /* Exports */
  router.get(
    '/exports',
    middleware.requireAdminPermission('admin.exports.create'),
    middleware.asyncHandler(controller.listExports)
  );

  router.post(
    '/exports',
    middleware.requireAdminPermission('admin.exports.create'),
    middleware.validateBody(ExportSchema),
    middleware.asyncHandler(controller.requestExport)
  );

  router.get(
    '/exports/:exportId/download',
    middleware.requireAdminPermission('admin.exports.create'),
    middleware.asyncHandler(controller.getExportDownload)
  );

  return router;
}

export default createAdminRoutes;