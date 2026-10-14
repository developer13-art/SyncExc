import { adminApi } from './client.js';

export const alertsApi = {
  rules: (params) => adminApi.getPaged('/alert-rules', { params }),
  getRule: (ruleId) => adminApi.get(`/alert-rules/${ruleId}`),
  createRule: (payload) => adminApi.post('/alert-rules', payload),
  updateRule: (ruleId, payload) => adminApi.patch(`/alert-rules/${ruleId}`, payload),
  deleteRule: (ruleId) => adminApi.delete(`/alert-rules/${ruleId}`),

  events: (params) => adminApi.getPaged('/alert-events', { params }),
  getEvent: (eventId) => adminApi.get(`/alert-events/${eventId}`),
  acknowledge: (eventId, payload) =>
    adminApi.post(`/alert-events/${eventId}/acknowledge`, payload),
  resolve: (eventId, payload) =>
    adminApi.post(`/alert-events/${eventId}/resolve`, payload),
  assign: (eventId, payload) =>
    adminApi.post(`/alert-events/${eventId}/assign`, payload),
};