import { adminApi } from './client.js';

export const usersApi = {
  list: (params) => adminApi.getPaged('/users', { params }),
  get: (userId) => adminApi.get(`/users/${userId}`),
  suspend: (userId, payload) => adminApi.post(`/users/${userId}/suspend`, payload),
  restore: (userId, payload) => adminApi.post(`/users/${userId}/restore`, payload),
  revokeSessions: (userId, payload) =>
    adminApi.post(`/users/${userId}/revoke-sessions`, payload),
  audit: (userId, params) => adminApi.getPaged(`/users/${userId}/audit`, { params }),
  securityEvents: (userId, params) =>
    adminApi.getPaged(`/users/${userId}/security-events`, { params }),
};