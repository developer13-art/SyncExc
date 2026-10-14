import { adminApi } from './client.js';

export const auditApi = {
  list: (params) => adminApi.getPaged('/audit-events', { params }),
  get: (eventId) => adminApi.get(`/audit-events/${eventId}`),
  export: (params) => adminApi.post('/audit-events/exports', params),
  savedViews: () => adminApi.get('/audit-events/saved-views'),
  saveView: (payload) => adminApi.post('/audit-events/saved-views', payload),
  deleteView: (viewId) => adminApi.delete(`/audit-events/saved-views/${viewId}`),
  dataAccess: (params) => adminApi.getPaged('/data-access-events', { params }),
};