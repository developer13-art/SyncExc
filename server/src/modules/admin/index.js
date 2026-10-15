/**
 * SyncExc Server — Admin module (Module 18)
 *
 * Owns:
 *   - platform overview dashboard
 *   - user administration
 *   - workspace administration
 *   - plan / subscription / payment / refund oversight
 *   - exchange integration restrictions
 *   - source discovery review
 *   - signal source administration
 *   - referral policy / payout / fraud oversight
 *   - support operations oversight
 *   - feature flags and controlled rollouts
 *   - admin roles, permissions, and separation of duties
 *   - admin approvals (dual control)
 *   - audit trail
 *   - operation jobs and exports
 *
 * Public API:
 *   admin.isFeatureEnabled({ key, userId, workspaceId })
 *   admin.writeAuditEvent(params)
 *   admin.requirePermission({ userId, permission })
 */

import { createAdminQueries } from './admin.queries.js';
import { createDashboardService } from './dashboard.service.js';
import { createAdminUserService } from './admin-user.service.js';
import { createAdminWorkspaceService } from './admin-workspace.service.js';
import { createAdminPlanService } from './admin-plan.service.js';
import { createAdminSubscriptionService } from './admin-subscription.service.js';
import { createAdminPaymentService } from './admin-payment.service.js';
import { createAdminRefundService } from './admin-refund.service.js';
import { createAdminExchangeService } from './admin-exchange.service.js';
import { createAdminSourceReviewService } from './admin-source-review.service.js';
import { createAdminSignalSourceService } from './admin-signal-source.service.js';
import { createAdminReferralService } from './admin-referral.service.js';
import { createAdminSupportService } from './admin-support.service.js';
import { createFeatureFlagService } from './feature-flag.service.js';
import { createFeatureFlagEvaluationService } from './feature-flag-evaluation.service.js';
import { createAdminRoleService } from './admin-role.service.js';
import { createAdminPermissionService } from './admin-permission.service.js';
import { createAdminApprovalService } from './admin-approval.service.js';
import { createAdminAuditService } from './admin-audit.service.js';
import { createAlertRuleService } from './alert-rule.service.js';
import { createAlertEventService } from './alert-event.service.js';
import { createOperationJobService } from './operation-job.service.js';
import { createExportService } from './export.service.js';
import { createStepUpAuthService } from './step-up-auth.service.js';
import { createAdminRoutes } from './admin.routes.js';
import { createLogger } from '../../lib/logger.js';

export function createAdminModule({ services }) {
  const logger = createLogger({ component: 'admin' });

  const queries = createAdminQueries({ db: services.db });

  const adminPermissionService = createAdminPermissionService({
    db: services.db,
    queries,
    logger,
  });

  const adminRoleService = createAdminRoleService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const adminApprovalService = createAdminApprovalService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const adminAuditService = createAdminAuditService({
    db: services.db,
    queries,
    logger,
  });

  const stepUpAuthService = createStepUpAuthService({
    db: services.db,
    queries,
    logger,
  });

  const dashboardService = createDashboardService({
    db: services.db,
    queries,
    logger,
  });

  const adminUserService = createAdminUserService({
    db: services.db,
    queries,
    events: services.events,
    approvals: adminApprovalService,
    audit: adminAuditService,
    logger,
  });

  const adminWorkspaceService = createAdminWorkspaceService({
    db: services.db,
    queries,
    events: services.events,
    audit: adminAuditService,
    logger,
  });

  const adminPlanService = createAdminPlanService({
    db: services.db,
    queries,
    events: services.events,
    audit: adminAuditService,
    logger,
  });

  const adminSubscriptionService = createAdminSubscriptionService({
    db: services.db,
    queries,
    billing: services.billing,
    events: services.events,
    audit: adminAuditService,
    logger,
  });

  const adminPaymentService = createAdminPaymentService({
    db: services.db,
    queries,
    audit: adminAuditService,
    logger,
  });

  const adminRefundService = createAdminRefundService({
    db: services.db,
    queries,
    billing: services.billing,
    approvals: adminApprovalService,
    events: services.events,
    audit: adminAuditService,
    logger,
  });

  const adminExchangeService = createAdminExchangeService({
    db: services.db,
    queries,
    events: services.events,
    audit: adminAuditService,
    logger,
  });

  const adminSourceReviewService = createAdminSourceReviewService({
    db: services.db,
    queries,
    sources: services.sources,
    events: services.events,
    audit: adminAuditService,
    logger,
  });

  const adminSignalSourceService = createAdminSignalSourceService({
    db: services.db,
    queries,
    sources: services.sources,
    audit: adminAuditService,
    logger,
  });

  const adminReferralService = createAdminReferralService({
    db: services.db,
    queries,
    referral: services.referral,
    approvals: adminApprovalService,
    events: services.events,
    audit: adminAuditService,
    logger,
  });

  const adminSupportService = createAdminSupportService({
    db: services.db,
    queries,
    support: services.support,
    audit: adminAuditService,
    logger,
  });

  const featureFlagService = createFeatureFlagService({
    db: services.db,
    queries,
    events: services.events,
    approvals: adminApprovalService,
    audit: adminAuditService,
    logger,
  });

  const featureFlagEvaluationService = createFeatureFlagEvaluationService({
    db: services.db,
    queries,
    logger,
  });

  const alertRuleService = createAlertRuleService({
    db: services.db,
    queries,
    audit: adminAuditService,
    logger,
  });

  const alertEventService = createAlertEventService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const operationJobService = createOperationJobService({
    db: services.db,
    queries,
    events: services.events,
    audit: adminAuditService,
    logger,
  });

  const exportService = createExportService({
    db: services.db,
    queries,
    storage: services.storage,
    jobs: services.jobs,
    audit: adminAuditService,
    logger,
  });

  const routes = createAdminRoutes({
    db: services.db,
    dashboardService,
    adminUserService,
    adminWorkspaceService,
    adminPlanService,
    adminSubscriptionService,
    adminPaymentService,
    adminRefundService,
    adminExchangeService,
    adminSourceReviewService,
    adminSignalSourceService,
    adminReferralService,
    adminSupportService,
    featureFlagService,
    featureFlagEvaluationService,
    adminRoleService,
    adminPermissionService,
    adminApprovalService,
    adminAuditService,
    alertRuleService,
    alertEventService,
    operationJobService,
    exportService,
    identity: services.identity,
    adminPermissionService,
    middleware: services.middleware,
  });

  const publicApi = {
    isFeatureEnabled: (params) => featureFlagEvaluationService.evaluate(params),
    writeAuditEvent: (params) => adminAuditService.write(params),
    requirePermission: (params) => adminPermissionService.require(params),
  };

  return {
    name: 'admin',
    routes,
    queries,
    dashboard: dashboardService,
    user: adminUserService,
    workspace: adminWorkspaceService,
    plan: adminPlanService,
    subscription: adminSubscriptionService,
    payment: adminPaymentService,
    refund: adminRefundService,
    exchange: adminExchangeService,
    sourceReview: adminSourceReviewService,
    signalSource: adminSignalSourceService,
    referral: adminReferralService,
    support: adminSupportService,
    featureFlag: featureFlagService,
    featureFlagEvaluation: featureFlagEvaluationService,
    role: adminRoleService,
    permission: adminPermissionService,
    approval: adminApprovalService,
    audit: adminAuditService,
    alertRule: alertRuleService,
    alertEvent: alertEventService,
    operationJob: operationJobService,
    export: exportService,
    stepUpAuth: stepUpAuthService,
    publicApi,

    async shutdown() {
      logger.debug('Admin module shutdown');
    },
  };
}

export default createAdminModule;