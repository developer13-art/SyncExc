import { adminApi } from './client.js';

export const operationJobsApi = {
  list: (params) => adminApi.getPaged('/operation-jobs', { params }),
  get: (jobId) => adminApi.get(`/operation-jobs/${jobId}`),
  events: (jobId, params) =>
    adminApi.getPaged(`/operation-jobs/${jobId}/events`, { params }),
  cancel: (jobId, payload) =>
    adminApi.post(`/operation-jobs/${jobId}/cancel`, payload),
  retry: (jobId, payload) => adminApi.post(`/operation-jobs/${jobId}/retry`, payload),
};