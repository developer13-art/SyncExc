import { adminApi } from './client.js';

export const exchangesApi = {
  list: (params) => adminApi.getPaged('/exchanges', { params }),
  get: (exchangeId) => adminApi.get(`/exchanges/${exchangeId}`),
  health: (exchangeId) => adminApi.get(`/exchanges/${exchangeId}/health`),
  capabilities: (exchangeId) => adminApi.get(`/exchanges/${exchangeId}/capabilities`),
  restrict: (exchangeId, payload) =>
    adminApi.post(`/exchanges/${exchangeId}/restrictions`, payload),
  healthCheck: (exchangeId) =>
    adminApi.post(`/exchanges/${exchangeId}/health-checks`, {}),
  adapterLifecycle: (exchangeId, payload) =>
    adminApi.post(`/exchanges/${exchangeId}/lifecycle-actions`, payload),
};