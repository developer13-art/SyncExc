import { adminApi } from './client.js';

export const featureFlagsApi = {
  list: (params) => adminApi.getPaged('/feature-flags', { params }),
  get: (flagId) => adminApi.get(`/feature-flags/${flagId}`),
  create: (payload) => adminApi.post('/feature-flags', payload),
  update: (flagId, payload) => adminApi.patch(`/feature-flags/${flagId}`, payload),
  publish: (flagId, payload) => adminApi.post(`/feature-flags/${flagId}/publish`, payload),
  versions: (flagId) => adminApi.get(`/feature-flags/${flagId}/versions`),
  rules: (flagId) => adminApi.get(`/feature-flags/${flagId}/rules`),
  createRule: (flagId, payload) =>
    adminApi.post(`/feature-flags/${flagId}/rules`, payload),
  updateRule: (flagId, ruleId, payload) =>
    adminApi.patch(`/feature-flags/${flagId}/rules/${ruleId}`, payload),
  deleteRule: (flagId, ruleId) =>
    adminApi.delete(`/feature-flags/${flagId}/rules/${ruleId}`),
  initiateRollout: (flagId, payload) =>
    adminApi.post(`/feature-flags/${flagId}/rollouts`, payload),
  requestRollback: (flagId, payload) =>
    adminApi.post(`/feature-flags/${flagId}/rollback`, payload),
  rollouts: (flagId) => adminApi.get(`/feature-flags/${flagId}/rollouts`),
  evaluations: (flagId, params) =>
    adminApi.getPaged(`/feature-flags/${flagId}/evaluations`, { params }),
};