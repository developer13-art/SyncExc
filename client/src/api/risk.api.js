import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const riskApi = {
  listPolicies: (params) => api.getPaged(endpoints.risk.policies, { params }),

  createPolicy: (payload) => api.post(endpoints.risk.policies, payload),

  getPolicy: (policyId) => api.get(endpoints.risk.policy(policyId)),

  updatePolicy: (policyId, payload) => api.patch(endpoints.risk.policy(policyId), payload),

  activatePolicy: (policyId, payload) =>
    api.post(endpoints.risk.activatePolicy(policyId), payload),

  suspendPolicy: (policyId, payload) =>
    api.post(endpoints.risk.suspendPolicy(policyId), payload),

  listPolicyVersions: (policyId) => api.get(endpoints.risk.policyVersions(policyId)),

  validatePolicy: (payload) => api.post(endpoints.risk.validatePolicy, payload),

  evaluate: (payload) => api.post(endpoints.risk.evaluate, payload),

  getEvaluation: (evaluationId) => api.get(endpoints.risk.evaluation(evaluationId)),

  getExposure: (params) => api.get(endpoints.risk.exposure, { params }),

  getAccountExposure: (accountId) => api.get(endpoints.risk.accountExposure(accountId)),

  getLimits: (params) => api.get(endpoints.risk.limits, { params }),

  listAlerts: (params) => api.getPaged(endpoints.risk.alerts, { params }),

  acknowledgeAlert: (alertId, payload) =>
    api.post(endpoints.risk.acknowledgeAlert(alertId), payload),

  listApprovals: (params) => api.getPaged(endpoints.risk.approvals, { params }),

  approve: (approvalId, payload) =>
    api.post(endpoints.risk.approveApproval(approvalId), payload),

  reject: (approvalId, payload) =>
    api.post(endpoints.risk.rejectApproval(approvalId), payload),

  revokeApproval: (approvalId, payload) =>
    api.post(endpoints.risk.revokeApproval(approvalId), payload),

  requestEmergencyPause: (payload) =>
    api.post(endpoints.risk.emergencyPause, payload),

  getEmergencyStatus: () => api.get(endpoints.risk.emergencyStatus),

  resumeEmergency: (pauseId, payload) =>
    api.post(endpoints.risk.resumeEmergency(pauseId), payload),

  listCircuitBreakers: (params) =>
    api.get(endpoints.risk.circuitBreakers, { params }),

  listIncidents: (params) => api.getPaged(endpoints.risk.incidents, { params }),

  getIncident: (incidentId) => api.get(endpoints.risk.incident(incidentId)),

  addIncidentAction: (incidentId, payload) =>
    api.post(endpoints.risk.incidentActions(incidentId), payload),

  resolveIncident: (incidentId, payload) =>
    api.post(endpoints.risk.incidentResolve(incidentId), payload),

  getIncidentAudit: (incidentId) => api.get(endpoints.risk.incidentAudit(incidentId)),
};