/**
 * SyncExc Server — Admin controller
 */

import { success, created, paginated } from '../../lib/response.js';

function pageOptions(req, fallbackLimit = 50) {
  const limit = Number(req.query.pageSize ?? req.query.limit) || fallbackLimit;
  const page = Number(req.query.page);
  return {
    limit,
    offset: Number.isInteger(page) && page > 0 ? (page - 1) * limit : undefined,
  };
}

export function createAdminController(services) {
  const {
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
    adminRoleService,
    adminPermissionService,
    adminApprovalService,
    adminAuditService,
    alertRuleService,
    alertEventService,
    operationJobService,
    exportService,
    db,
  } = services;

  return {
    /* Dashboard */
    async getOverview(req, res) {
      const data = await dashboardService.getOverview({ timeRange: req.query.timeRange });
      return success(res, data);
    },

    async getHealth(_req, res) {
      const database = await db.health();
      const healthy = database.ok;
      return success(res, {
        overallStatus: healthy ? 'healthy' : 'degraded',
        services: [
          {
            name: 'Database',
            status: healthy ? 'healthy' : 'unavailable',
          },
        ],
        activeIncidents: [],
        dataFreshness: null,
      });
    },

    /* Users */
    async searchUsers(req, res) {
      const { limit, offset } = pageOptions(req);
      const { rows, nextCursor, total } = await adminUserService.searchUsers({
        query: req.query.q,
        status: req.query.status,
        limit,
        cursor: req.query.cursor || null,
        offset,
      });
      return paginated(res, rows, { nextCursor, limit, total });
    },

    async getUser(req, res) {
      const result = await adminUserService.getUser({
        userId: req.params.userId,
        actorId: req.auth.userId,
      });
      return success(res, result);
    },

    async searchUserAudit(req, res) {
      const limit = Number(req.query.pageSize ?? req.query.limit) || 50;
      const { rows, nextCursor } = await adminAuditService.search({
        targetId: req.params.userId,
        limit,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows, { nextCursor, limit });
    },

    async suspendUser(req, res) {
      const result = await adminUserService.suspendUser({
        userId: req.params.userId,
        actorId: req.auth.userId,
        reason: req.body.reason,
        scope: req.body.scope,
        durationHours: req.body.durationHours,
      });
      return success(res, result);
    },

    async restoreUser(req, res) {
      const result = await adminUserService.restoreUser({
        userId: req.params.userId,
        actorId: req.auth.userId,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    async revokeUserSessions(req, res) {
      const result = await adminUserService.revokeUserSessions({
        userId: req.params.userId,
        actorId: req.auth.userId,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    async requireMfaReset(req, res) {
      const result = await adminUserService.requireMfaReset({
        userId: req.params.userId,
        actorId: req.auth.userId,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    /* Workspaces */
    async searchWorkspaces(req, res) {
      const { limit, offset } = pageOptions(req);
      const { rows, nextCursor, total } = await adminWorkspaceService.searchWorkspaces({
        query: req.query.q,
        type: req.query.type,
        status: req.query.status,
        limit,
        cursor: req.query.cursor || null,
        offset,
      });
      return paginated(res, rows, { nextCursor, limit, total });
    },

    async getWorkspace(req, res) {
      const result = await adminWorkspaceService.getWorkspace({
        workspaceId: req.params.workspaceId,
        actorId: req.auth.userId,
      });
      return success(res, result);
    },

    async suspendWorkspace(req, res) {
      const result = await adminWorkspaceService.suspendWorkspace({
        workspaceId: req.params.workspaceId,
        actorId: req.auth.userId,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    async restoreWorkspace(req, res) {
      const result = await adminWorkspaceService.restoreWorkspace({
        workspaceId: req.params.workspaceId,
        actorId: req.auth.userId,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    async revokeShareGrant(req, res) {
      const result = await adminWorkspaceService.revokeShareGrant({
        grantId: req.params.grantId,
        actorId: req.auth.userId,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    /* Plans */
    async listPlans(req, res) {
      const plans = await adminPlanService.listPlans({ status: req.query.status });
      return success(res, plans);
    },

    async getPlan(req, res) {
      const plan = await adminPlanService.getPlan({ planId: req.params.planId });
      return success(res, plan);
    },

    async createPlan(req, res) {
      const plan = await adminPlanService.createPlan({
        userId: req.auth.userId,
        code: req.body.code,
        name: req.body.name,
        description: req.body.description,
        features: req.body.features,
        limits: req.body.limits,
        prices: req.body.prices,
      });
      return created(res, plan);
    },

    async updatePlan(req, res) {
      const plan = await adminPlanService.updatePlan({
        userId: req.auth.userId,
        planId: req.params.planId,
        ...req.body,
      });
      return success(res, plan);
    },

    async publishPlan(req, res) {
      const plan = await adminPlanService.publishPlan({
        planId: req.params.planId,
        actorId: req.auth.userId,
      });
      return success(res, plan);
    },

    async retirePlan(req, res) {
      const plan = await adminPlanService.retirePlan({
        planId: req.params.planId,
        actorId: req.auth.userId,
        reason: req.body.reason,
      });
      return success(res, plan);
    },

    async createPlanVersion(req, res) {
      const version = await adminPlanService.createPlanVersion({
        userId: req.auth.userId,
        planId: req.params.planId,
        features: req.body.features,
        limits: req.body.limits,
        prices: req.body.prices,
        effectiveFrom: req.body.effectiveFrom,
      });
      return created(res, version);
    },

    /* Subscriptions */
    async searchSubscriptions(req, res) {
      const { limit, offset } = pageOptions(req);
      const { rows, nextCursor, total } = await adminSubscriptionService.searchSubscriptions({
        status: req.query.status,
        planId: req.query.planId,
        scopeType: req.query.scopeType,
        scopeId: req.query.scopeId,
        limit,
        cursor: req.query.cursor || null,
        offset,
      });
      return paginated(res, rows, { nextCursor, limit, total });
    },

    async getSubscription(req, res) {
      const result = await adminSubscriptionService.getSubscription({
        subscriptionId: req.params.subscriptionId,
        actorId: req.auth.userId,
      });
      return success(res, result);
    },

    async applyCredit(req, res) {
      const result = await adminSubscriptionService.applyCredit({
        subscriptionId: req.params.subscriptionId,
        actorId: req.auth.userId,
        amountMinor: req.body.amountMinor,
        currency: req.body.currency,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    /* Payments */
    async searchPayments(req, res) {
      const { limit, offset } = pageOptions(req);
      const { rows, nextCursor, total } = await adminPaymentService.searchPayments({
        status: req.query.status,
        provider: req.query.provider,
        from: req.query.from,
        to: req.query.to,
        limit,
        cursor: req.query.cursor || null,
        offset,
      });
      return paginated(res, rows, { nextCursor, limit, total });
    },

    async getPayment(req, res) {
      const result = await adminPaymentService.getPayment({
        paymentId: req.params.paymentId,
        actorId: req.auth.userId,
      });
      return success(res, result);
    },

    /* Refunds */
    async listRefunds(req, res) {
      const refunds = await adminRefundService.listRefunds({
        status: req.query.status,
        limit: Number(req.query.limit) || 50,
      });
      return success(res, refunds);
    },

    async initiateRefund(req, res) {
      const result = await adminRefundService.initiateRefund({
        userId: req.auth.userId,
        paymentId: req.body.paymentId,
        amountMinor: req.body.amountMinor,
        currency: req.body.currency,
        reason: req.body.reason,
      });
      return created(res, result);
    },

    async getRefund(req, res) {
      const result = await adminRefundService.getRefund({
        refundId: req.params.refundId,
        actorId: req.auth.userId,
      });
      return success(res, result);
    },

    /* Exchanges */
    async listExchanges(req, res) {
      const exchanges = await adminExchangeService.listExchanges();
      return success(res, exchanges);
    },

    async getExchangeHealth(req, res) {
      const result = await adminExchangeService.getExchangeHealth({
        exchangeCode: req.params.exchangeCode,
        actorId: req.auth.userId,
      });
      return success(res, result);
    },

    async restrictCapability(req, res) {
      const result = await adminExchangeService.restrictCapability({
        exchangeCode: req.params.exchangeCode,
        capabilityKey: req.body.capabilityKey,
        actorId: req.auth.userId,
        reason: req.body.reason,
        expiresAt: req.body.expiresAt,
      });
      return success(res, result);
    },

    /* Source review */
    async listSourceCandidates(req, res) {
      const { limit, offset } = pageOptions(req, 100);
      const { rows, total } = await adminSourceReviewService.listCandidates({
        status: req.query.status,
        search: req.query.q,
        limit,
        offset,
      });
      return paginated(res, rows, { limit, total });
    },

    async getSourceCandidate(req, res) {
      const result = await adminSourceReviewService.getCandidate({
        candidateId: req.params.candidateId,
        actorId: req.auth.userId,
      });
      return success(res, result);
    },

    async decideSourceCandidate(req, res) {
      const result = await adminSourceReviewService.decide({
        candidateId: req.params.candidateId,
        reviewerId: req.auth.userId,
        decision: req.body.decision,
        reason: req.body.reason,
        scope: req.body.scope,
      });
      return success(res, result);
    },

    /* Signal sources */
    async listSignalSources(req, res) {
      const sources = await adminSignalSourceService.listSources({
        status: req.query.status,
        type: req.query.type,
        limit: Number(req.query.limit) || 100,
      });
      return success(res, sources);
    },

    async getSignalSource(req, res) {
      const result = await adminSignalSourceService.getSource({
        sourceId: req.params.sourceId,
        actorId: req.auth.userId,
      });
      return success(res, result);
    },

    async signalSourceAction(req, res) {
      const result = await adminSignalSourceService.lifecycleAction({
        sourceId: req.params.sourceId,
        actorId: req.auth.userId,
        action: req.body.action,
        reason: req.body.reason,
        scope: req.body.scope,
      });
      return success(res, result);
    },

    /* Referral */
    async listReferralPolicies(req, res) {
      const policies = await adminReferralService.listPolicies();
      return success(res, policies);
    },

    async createReferralPolicy(req, res) {
      const result = await adminReferralService.createPolicyDraft({
        userId: req.auth.userId,
        name: req.body.name,
        config: req.body.config,
        effectiveFrom: req.body.effectiveFrom,
      });
      return created(res, result);
    },

    async publishReferralPolicy(req, res) {
      const result = await adminReferralService.publishPolicy({
        policyId: req.params.policyId,
        actorId: req.auth.userId,
        reason: req.body.reason,
      });
      return created(res, result);
    },

    async listPayouts(req, res) {
      const { limit, offset } = pageOptions(req);
      const { rows, nextCursor, total, totals } = await adminReferralService.listPayouts({
        status: req.query.status,
        limit,
        cursor: req.query.cursor || null,
        offset,
      });
      return paginated(res, rows, { nextCursor, limit, total, totals });
    },

    async listCommissions(req, res) {
      const { limit, offset } = pageOptions(req);
      const { rows, nextCursor, total, totals } = await adminReferralService.listCommissions({
        state: req.query.state,
        limit,
        cursor: req.query.cursor || null,
        offset,
      });
      return paginated(res, rows, { nextCursor, limit, total, totals });
    },

    async reviewPayout(req, res) {
      const result = await adminReferralService.reviewPayout({
        payoutId: req.params.payoutId,
        actorId: req.auth.userId,
        decision: req.body.decision,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    async listFraudCases(req, res) {
      const cases = await adminReferralService.listFraudCases({
        state: req.query.state,
        limit: Number(req.query.limit) || 50,
      });
      return success(res, cases);
    },

    async decideFraudCase(req, res) {
      const result = await adminReferralService.decideFraudCase({
        caseId: req.params.caseId,
        actorId: req.auth.userId,
        decision: req.body.decision,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    /* Support */
    async listSupportQueues(req, res) {
      const queues = await adminSupportService.listQueues();
      return success(res, queues);
    },

    async listQueueMembers(req, res) {
      const members = await adminSupportService.listQueueMembers({
        queueId: req.params.queueId,
      });
      return success(res, members);
    },

    async addQueueMember(req, res) {
      const result = await adminSupportService.addQueueMember({
        queueId: req.params.queueId,
        userId: req.body.userId,
        role: req.body.role,
        actorId: req.auth.userId,
      });
      return created(res, result);
    },

    async removeQueueMember(req, res) {
      const result = await adminSupportService.removeQueueMember({
        queueId: req.params.queueId,
        userId: req.params.userId,
        actorId: req.auth.userId,
      });
      return success(res, result);
    },

    async getSupportMetrics(req, res) {
      const since = req.query.since ? new Date(req.query.since) : null;
      const metrics = await adminSupportService.getMetrics({ since });
      return success(res, metrics);
    },

    /* Feature flags */
    async listFeatureFlags(req, res) {
      const flags = await featureFlagService.listFlags({
        environment: req.query.environment,
      });
      return success(res, flags);
    },

    async createFeatureFlag(req, res) {
      const flag = await featureFlagService.createFlag({
        userId: req.auth.userId,
        key: req.body.key,
        description: req.body.description,
        owningTeam: req.body.owningTeam,
        relatedModule: req.body.relatedModule,
        type: req.body.type,
        defaultValue: req.body.defaultValue,
        environment: req.body.environment,
        targetingRules: req.body.targetingRules,
        expiresAt: req.body.expiresAt,
      });
      return created(res, flag);
    },

    async getFeatureFlag(req, res) {
      const result = await featureFlagService.getFlag({ flagId: req.params.flagId });
      return success(res, result);
    },

    async updateFeatureFlag(req, res) {
      const result = await featureFlagService.updateFlag({
        userId: req.auth.userId,
        flagId: req.params.flagId,
        enabled: req.body.enabled,
        defaultValue: req.body.defaultValue,
        targetingRules: req.body.targetingRules,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    async initiateRollout(req, res) {
      const result = await featureFlagService.rollout({
        userId: req.auth.userId,
        flagId: req.params.flagId,
        targetPercentage: req.body.targetPercentage,
        targetRules: req.body.targetRules,
        environment: req.body.environment,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    async rollbackFeatureFlag(req, res) {
      const result = await featureFlagService.rollback({
        userId: req.auth.userId,
        flagId: req.params.flagId,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    /* Roles */
    async listRoles(req, res) {
      const roles = await adminRoleService.listRoles();
      return success(res, roles);
    },

    async createRole(req, res) {
      const role = await adminRoleService.createRole({
        userId: req.auth.userId,
        name: req.body.name,
        description: req.body.description,
        permissions: req.body.permissions,
      });
      return created(res, role);
    },

    async updateRole(req, res) {
      const result = await adminRoleService.updateRole({
        userId: req.auth.userId,
        roleId: req.params.roleId,
        description: req.body.description,
        permissions: req.body.permissions,
      });
      return success(res, result);
    },

    async assignRole(req, res) {
      const result = await adminRoleService.assignRole({
        userId: req.auth.userId,
        targetUserId: req.body.userId,
        roleId: req.body.roleId,
        scopeType: req.body.scopeType,
        scopeId: req.body.scopeId,
      });
      return created(res, result);
    },

    async revokeRole(req, res) {
      const result = await adminRoleService.revokeRole({
        userId: req.auth.userId,
        assignmentId: req.params.assignmentId,
      });
      return success(res, result);
    },

    async listPermissions(req, res) {
      const permissions = await adminRoleService.listPermissions();
      return success(res, permissions);
    },

    async listRoleAssignments(req, res) {
      const assignments = await adminRoleService.listAssignments(req.params.userId);
      return success(res, assignments);
    },

    /* Approvals */
    async listApprovals(req, res) {
      const approvals = await adminApprovalService.listPending();
      return success(res, approvals);
    },

    async decideApproval(req, res) {
      const result = await adminApprovalService.decide({
        approvalId: req.params.approvalId,
        decidedBy: req.auth.userId,
        decision: req.body.decision,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    /* Audit */
    async searchAudit(req, res) {
      const { rows, nextCursor } = await adminAuditService.search({
        actorId: req.query.actorId,
        action: req.query.action,
        targetResource: req.query.targetResource,
        targetId: req.query.targetId,
        outcome: req.query.outcome,
        from: req.query.from ? new Date(req.query.from) : null,
        to: req.query.to ? new Date(req.query.to) : null,
        limit: Number(req.query.limit) || 100,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows, { nextCursor, limit: Number(req.query.limit) || 100 });
    },

    /* Alert rules */
    async listAlertRules(req, res) {
      const rules = await alertRuleService.listRules({ enabled: req.query.enabled });
      return success(res, rules);
    },

    async createAlertRule(req, res) {
      const rule = await alertRuleService.createRule({
        userId: req.auth.userId,
        name: req.body.name,
        metricKey: req.body.metricKey,
        threshold: req.body.threshold,
        comparison: req.body.comparison,
        severity: req.body.severity,
      });
      return created(res, rule);
    },

    async updateAlertRule(req, res) {
      const rule = await alertRuleService.updateRule({
        ruleId: req.params.ruleId,
        actorId: req.auth.userId,
        updates: req.body,
      });
      return success(res, rule);
    },

    /* Alert events */
    async listAlertEvents(req, res) {
      const events = await alertEventService.listEvents({
        state: req.query.state,
        limit: Number(req.query.limit) || 100,
      });
      return success(res, events);
    },

    async acknowledgeAlert(req, res) {
      const result = await alertEventService.acknowledge({
        eventId: req.params.alertId,
        userId: req.auth.userId,
      });
      return success(res, result);
    },

    async resolveAlert(req, res) {
      const result = await alertEventService.resolve({
        eventId: req.params.alertId,
      });
      return success(res, result);
    },

    /* Operation jobs */
    async listOperationJobs(req, res) {
      const jobs = await operationJobService.listJobs({
        state: req.query.state,
        limit: Number(req.query.limit) || 50,
      });
      return success(res, jobs);
    },

    async getOperationJob(req, res) {
      const result = await operationJobService.getJob({
        jobId: req.params.jobId,
        actorId: req.auth.userId,
      });
      return success(res, result);
    },

    async cancelOperationJob(req, res) {
      const result = await operationJobService.cancelJob({
        jobId: req.params.jobId,
        actorId: req.auth.userId,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    /* Exports */
    async listExports(req, res) {
      const exports = await exportService.listExports({
        userId: req.auth.userId,
        limit: Number(req.query.limit) || 50,
      });
      return success(res, exports);
    },

    async requestExport(req, res) {
      const result = await exportService.requestExport({
        userId: req.auth.userId,
        resourceType: req.body.resourceType,
        filters: req.body.filters,
        reason: req.body.reason,
      });
      return created(res, result);
    },

    async getExportDownload(req, res) {
      const result = await exportService.getDownloadUrl({
        exportId: req.params.exportId,
        userId: req.auth.userId,
      });
      return success(res, result);
    },
  };
}

export default createAdminController;