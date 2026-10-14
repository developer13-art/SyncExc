import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const adminApi = {
  getDashboard: (params) => api.get(endpoints.admin.dashboard, { params }),

  listUsers: (params) => api.getPaged(endpoints.admin.users, { params }),

  getUser: (userId) => api.get(endpoints.admin.user(userId)),

  suspendUser: (userId, payload) => api.post(endpoints.admin.suspendUser(userId), payload),

  restoreUser: (userId, payload) => api.post(endpoints.admin.restoreUser(userId), payload),

  revokeUserSessions: (userId, payload) =>
    api.post(endpoints.admin.revokeUserSessions(userId), payload),

  getUserAudit: (userId, params) =>
    api.getPaged(endpoints.admin.userAudit(userId), { params }),

  listWorkspaces: (params) => api.getPaged(endpoints.admin.workspaces, { params }),

  getWorkspace: (workspaceId) => api.get(endpoints.admin.workspace(workspaceId)),

  getWorkspaceMembers: (workspaceId, params) =>
    api.getPaged(endpoints.admin.workspaceMembers(workspaceId), { params }),

  listPlans: (params) => api.getPaged(endpoints.admin.plans, { params }),

  createPlan: (payload) => api.post(endpoints.admin.plans, payload),

  getPlan: (planId) => api.get(endpoints.admin.plan(planId)),

  updatePlan: (planId, payload) => api.patch(endpoints.admin.plan(planId), payload),

  publishPlan: (planId, payload) =>
    api.post(endpoints.admin.publishPlan(planId), payload),

  listSubscriptions: (params) =>
    api.getPaged(endpoints.admin.subscriptions, { params }),

  getSubscription: (subscriptionId) =>
    api.get(endpoints.admin.subscription(subscriptionId)),

  listPayments: (params) => api.getPaged(endpoints.admin.payments, { params }),

  getPayment: (paymentId) => api.get(endpoints.admin.payment(paymentId)),

  initiateRefund: (paymentId, payload) =>
    api.post(`${endpoints.admin.refundRequests}/${paymentId}`, payload),

  listRefunds: (params) => api.getPaged(endpoints.admin.refunds, { params }),

  listExchanges: (params) => api.get(endpoints.admin.exchanges, { params }),

  getExchangeHealth: (exchangeId) => api.get(endpoints.admin.exchangeHealth(exchangeId)),

  getExchangeCapabilities: (exchangeId) =>
    api.get(endpoints.admin.exchangeCapabilities(exchangeId)),

  restrictExchange: (exchangeId, payload) =>
    api.post(endpoints.admin.exchangeRestrictions(exchangeId), payload),

  triggerExchangeHealthCheck: (exchangeId) =>
    api.post(endpoints.admin.exchangeHealthChecks(exchangeId)),

  listSourceDiscoveryCandidates: (params) =>
    api.getPaged(endpoints.admin.sourceDiscoveryCandidates, { params }),

  getSourceDiscoveryCandidate: (candidateId) =>
    api.get(endpoints.admin.sourceDiscoveryCandidate(candidateId)),

  decideSourceCandidate: (candidateId, payload) =>
    api.post(endpoints.admin.sourceDiscoveryDecision(candidateId), payload),

  listSignalSources: (params) =>
    api.getPaged(endpoints.admin.signalSources, { params }),

  applySignalSourceLifecycle: (sourceId, payload) =>
    api.post(endpoints.admin.signalSourceLifecycle(sourceId), payload),

  listReferralPolicies: (params) =>
    api.getPaged(endpoints.admin.referralPolicies, { params }),

  createReferralPolicy: (payload) => api.post(endpoints.admin.referralPolicies, payload),

  publishReferralPolicy: (policyId, payload) =>
    api.post(endpoints.admin.publishReferralPolicy(policyId), payload),

  listReferralCommissions: (params) =>
    api.getPaged(endpoints.admin.referralCommissions, { params }),

  listReferralPayouts: (params) =>
    api.getPaged(endpoints.admin.referralPayouts, { params }),

  listSupportQueues: () => api.get(endpoints.admin.supportQueues),

  getSupportMetrics: (params) => api.get(endpoints.admin.supportMetrics, { params }),

  listRoles: (params) => api.getPaged(endpoints.admin.roles, { params }),

  createRole: (payload) => api.post(endpoints.admin.roles, payload),

  updateRole: (roleId, payload) => api.patch(`${endpoints.admin.roles}/${roleId}`, payload),

  deleteRole: (roleId) => api.delete(`${endpoints.admin.roles}/${roleId}`),

  listPermissions: () => api.get(endpoints.admin.permissions),

  listAuditEvents: (params) => api.getPaged(endpoints.admin.auditEvents, { params }),

  listFeatureFlags: (params) =>
    api.getPaged(endpoints.admin.featureFlags, { params }),

  createFeatureFlag: (payload) => api.post(endpoints.admin.featureFlags, payload),

  initiateRollout: (flagId, payload) =>
    api.post(endpoints.admin.featureFlagRollouts(flagId), payload),

  requestRollback: (flagId, payload) =>
    api.post(endpoints.admin.featureFlagRollback(flagId), payload),

  getOperationJob: (jobId) => api.get(endpoints.admin.operationJob(jobId)),

  listApprovals: (params) => api.getPaged('/admin/approvals', { params }),

  approveApproval: (approvalId, payload) =>
    api.post(`/admin/approvals/${approvalId}/approve`, payload),

  rejectApproval: (approvalId, payload) =>
    api.post(`/admin/approvals/${approvalId}/reject`, payload),

  listAlertRules: (params) => api.getPaged('/admin/alert-rules', { params }),

  listAlertEvents: (params) => api.getPaged('/admin/alert-events', { params }),
};