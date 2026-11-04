import { adminApi } from './client.js';

export const incidentsApi = {
  list: (params) => adminApi.getPaged('/incidents', { params }),
  get: (incidentId) => adminApi.get(`/incidents/${incidentId}`),
  create: (payload) => adminApi.post('/incidents', payload),
  update: (incidentId, payload) => adminApi.patch(`/incidents/${incidentId}`, payload),
  resolve: (incidentId, payload) =>
    adminApi.post(`/incidents/${incidentId}/resolve`, payload),
  addEvent: (incidentId, payload) =>
    adminApi.post(`/incidents/${incidentId}/events`, payload),
};
