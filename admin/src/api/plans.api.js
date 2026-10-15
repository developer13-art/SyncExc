import { adminApi } from './client.js';

export const plansApi = {
  list: (params) => adminApi.getPaged('/plans', { params }),
  get: (planId) => adminApi.get(`/plans/${planId}`),
  create: (payload) => adminApi.post('/plans', payload),
  update: (planId, payload) => adminApi.patch(`/plans/${planId}`, payload),
  createVersion: (planId, payload) => adminApi.post(`/plans/${planId}/versions`, payload),
  publish: (planId, payload) => adminApi.post(`/plans/${planId}/publish`, payload),
  retire: (planId, payload) => adminApi.post(`/plans/${planId}/retire`, payload),
  versions: (planId) => adminApi.get(`/plans/${planId}/versions`),
};