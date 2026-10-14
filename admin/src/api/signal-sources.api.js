import { adminApi } from './client.js';

export const signalSourcesApi = {
  list: (params) => adminApi.getPaged('/signal-sources', { params }),
  get: (sourceId) => adminApi.get(`/signal-sources/${sourceId}`),
  lifecycle: (sourceId, payload) =>
    adminApi.post(`/signal-sources/${sourceId}/lifecycle-actions`, payload),
  audit: (sourceId, params) =>
    adminApi.getPaged(`/signal-sources/${sourceId}/audit`, { params }),
  health: (sourceId) => adminApi.get(`/signal-sources/${sourceId}/health`),
  quality: (sourceId) => adminApi.get(`/signal-sources/${sourceId}/quality`),
};