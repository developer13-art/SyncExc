import { adminApi } from './client.js';

const base = '/official-trader';

export const officialTraderApi = {
  overview: () => adminApi.get(`${base}/overview`),

  settings: () => adminApi.get(`${base}/settings`),
  updateSettings: (payload) => adminApi.patch(`${base}/settings`, payload),

  exchangeCatalog: () => adminApi.get(`${base}/exchange-catalog`),
  connections: () => adminApi.get(`${base}/connections`),
  availableConnections: () => adminApi.get(`${base}/available-connections`),
  connectExchange: (payload) => adminApi.post(`${base}/connections/connect`, payload),
  assignConnection: (payload) => adminApi.post(`${base}/connections/assign`, payload),
  updateConnection: (assignmentId, payload) =>
    adminApi.patch(`${base}/connections/${assignmentId}`, payload),
  removeConnection: (assignmentId, payload) =>
    adminApi.delete(`${base}/connections/${assignmentId}`, { data: payload }),

  pause: (payload) => adminApi.post(`${base}/pause`, payload),
  resume: (payload) => adminApi.post(`${base}/resume`, payload),

  researchRuns: (params) => adminApi.getPaged(`${base}/research/runs`, { params }),
  researchRun: (runId) => adminApi.get(`${base}/research/runs/${runId}`),
  runResearch: (payload) => adminApi.post(`${base}/research/run`, payload),

  analyses: (params) => adminApi.getPaged(`${base}/analyses`, { params }),
  analysis: (analysisId) => adminApi.get(`${base}/analyses/${analysisId}`),
  validateAnalysis: (analysisId, payload) =>
    adminApi.post(`${base}/analyses/${analysisId}/validate`, payload),
  validatePending: (payload) => adminApi.post(`${base}/analyses/validate-pending`, payload),
  executeAnalysis: (analysisId, payload) =>
    adminApi.post(`${base}/analyses/${analysisId}/execute`, payload),

  executions: (params) => adminApi.getPaged(`${base}/executions`, { params }),
  execution: (executionId) => adminApi.get(`${base}/executions/${executionId}`),
  confirmExecution: (executionId, payload) =>
    adminApi.post(`${base}/executions/${executionId}/confirm`, payload),
  syncExecution: (executionId) => adminApi.post(`${base}/executions/${executionId}/sync`),
  reconcile: (payload) => adminApi.post(`${base}/reconcile`, payload),

  performance: (params) => adminApi.get(`${base}/performance`, { params }),
  snapshot: (payload) => adminApi.post(`${base}/performance/snapshot`, payload),
  closures: (params) => adminApi.getPaged(`${base}/closures`, { params }),

  marketplace: () => adminApi.get(`${base}/marketplace`),
  createPlan: (payload) => adminApi.post(`${base}/marketplace/plans`, payload),
  updatePlan: (planId, payload) => adminApi.patch(`${base}/marketplace/plans/${planId}`, payload),
  setPlanStatus: (planId, payload) =>
    adminApi.patch(`${base}/marketplace/plans/${planId}/status`, payload),
  signals: (params) => adminApi.getPaged(`${base}/signals`, { params }),
  subscribers: (params) => adminApi.getPaged(`${base}/subscribers`, { params }),
  copyOperations: (params) => adminApi.getPaged(`${base}/copy-operations`, { params }),

  risk: () => adminApi.get(`${base}/risk`),
  events: (params) => adminApi.getPaged(`${base}/events`, { params }),
};

export default officialTraderApi;
