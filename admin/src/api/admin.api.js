import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const adminApi = {
  // Dashboard
  getDashboard: (params) => api.get(endpoints.dashboard.get, { params }),
  getHealth: () => api.get(endpoints.dashboard.health),
  getIncidents: (params) => api.getPaged(endpoints.dashboard.incidents, { params }),

  // Users
  listUsers: (params) => api.getPaged(endpoints.users.list, { params }),
  getUser: (userId) => api.get(endpoints.users.detail(userId)),
  suspendUser: (userId, payload) => api.post(endpoints.users.suspend(userId), payload),
  restoreUser: (userId, payload) => api.post(endpoints.users.restore(userId), payload),
  revokeUserSessions: (userId, payload) =>
    api.post(endpoints.users.revokeSessions(userId), payload),
  getUserAudit: (userId, params) =>
    api.getPaged(endpoints.users.audit(userId), { params }),

  // Workspaces
  listWorkspaces: (params) => api.getPaged(endpoints.workspaces.list, { params }),
  getWorkspace: (workspaceId) => api.get(endpoints.workspaces.detail(workspaceId)),
  getWorkspaceMembers: (workspaceId, params) =>
    api.getPaged(endpoints.workspaces.members(workspaceId), { params }),

  // Plans
  listPlans: (params) => api.getPaged(endpoints.plans.list, { params }),
  createPlan: (payload) => api.post(endpoints.plans.create, payload),
  getPlan: (planId) => api.get(endpoints.plans.detail(planId)),
  updatePlan: (planId, payload) => api.patch(endpoints.plans.detail(planId), payload),
  publishPlan: (planId, payload) => api.post(endpoints.plans.publish(planId), payload),

  // Subscriptions
  listSubscriptions: (params) => api.getPaged(endpoints.subscriptions.list, { params }),
  getSubscription: (subscriptionId) =>
    api.get(endpoints.subscriptions.detail(subscriptionId)),

  // Payments
  listPayments: (params) => api.getPaged(endpoints.payments.list, { params }),
  getPayment: (paymentId) => api.get(endpoints.payments.detail(paymentId)),
  listRefundRequests: (params) =>
    api.getPaged(endpoints.payments.refundRequests, { params }),

  // Refunds
  listRefunds: (params) => api.getPaged(endpoints.refunds.list, { params }),
  approveRefund: (refundId, payload) =>
    api.post(endpoints.refunds.approve(refundId), payload),
  rejectRefund: (refundId, payload) =>
    api.post(endpoints.refunds.reject(refundId), payload),

  // Exchanges
  listExchanges: (params) => api.get(endpoints.exchanges.list, { params }),
  getExchangeHealth: (exchangeId) =>
    api.get(endpoints.exchanges.health(exchangeId)),
  getExchangeCapabilities: (exchangeId) =>
    api.get(endpoints.exchanges.capabilities(exchangeId)),
  restrictExchange: (exchangeId, payload) =>
    api.post(endpoints.exchanges.restrictions(exchangeId), payload),
  triggerHealthCheck: (exchangeId) =>
    api.post(endpoints.exchanges.healthChecks(exchangeId)),

  // Source Discovery
  listSourceDiscoveryCandidates: (params) =>
    api.getPaged(endpoints.sourceDiscovery.candidates, { params }),
  getSourceDiscoveryCandidate: (candidateId) =>
    api.get(endpoints.sourceDiscovery.candidate(candidateId)),
  decideSourceDiscoveryCandidate: (candidateId, payload) =>
    api.post(endpoints.sourceDiscovery.decision(candidateId), payload),

  // Signal Sources
  listSignalSources: (params) =>
    api.getPaged(endpoints.signalSources.list, { params }),
  applySignalSourceLifecycle: (sourceId, payload) =>
    api.post(endpoints.signalSources.lifecycle(sourceId), payload),

  // Referrals
  listReferralPolicies: (params) =>
    api.getPaged(endpoints.referrals.policies, { params }),
  createReferralPolicy: (payload) =>
    api.post(endpoints.referrals.policies, payload),
  publishReferralPolicy: (policyId, payload) =>
    api.post(endpoints.referrals.publishPolicy(policyId), payload),
  listReferralCommissions: (params) =>
    api.getPaged(endpoints.referrals.commissions, { params }),
  listReferralPayouts: (params) =>
    api.getPaged(endpoints.referrals.payouts, { params }),

  // Support
  listSupportQueues: () => api.get(endpoints.support.queues),
  getSupportMetrics: (params) => api.get(endpoints.support.metrics, { params }),

  // Roles & permissions
  listRoles: (params) => api.getPaged(endpoints.roles.list, { params }),
  createRole: (payload) => api.post(endpoints.roles.create, payload),
  updateRole: (roleId, payload) => api.patch(endpoints.roles.detail(roleId), payload),
  deleteRole: (roleId) => api.delete(endpoints.roles.detail(roleId)),
  listPermissions: () => api.get(endpoints.permissions.list),

  // Approvals
  listApprovals: (params) => api.getPaged(endpoints.approvals.list, { params }),
  approveApproval: (approvalId, payload) =>
    api.post(endpoints.approvals.approve(approvalId), payload),
  rejectApproval: (approvalId, payload) =>
    api.post(endpoints.approvals.reject(approvalId), payload),

  // Audit
  listAuditEvents: (params) => api.getPaged(endpoints.audit.list, { params }),
  getAuditEvent: (eventId) => api.get(endpoints.audit.detail(eventId)),

  // Feature flags
  listFeatureFlags: (params) => api.getPaged(endpoints.featureFlags.list, { params }),
  createFeatureFlag: (payload) => api.post(endpoints.featureFlags.create, payload),
  getFeatureFlag: (flagId) => api.get(endpoints.featureFlags.detail(flagId)),
  updateFeatureFlag: (flagId, payload) =>
    api.patch(endpoints.featureFlags.detail(flagId), payload),
  initiateRollout: (flagId, payload) =>
    api.post(endpoints.featureFlags.rollouts(flagId), payload),
  requestRollback: (flagId, payload) =>
    api.post(endpoints.featureFlags.rollback(flagId), payload),

  // Alerts
  listAlertRules: (params) => api.getPaged(endpoints.alerts.rules, { params }),
  listAlertEvents: (params) => api.getPaged(endpoints.alerts.events, { params }),

  // Operation jobs
  getOperationJob: (jobId) => api.get(endpoints.operationJobs.detail(jobId)),
};