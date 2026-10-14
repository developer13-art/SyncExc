import { adminApi } from './client.js';

export const adminAuthApi = {
  login: (payload) => adminApi.post('/auth/login', payload),
  logout: () => adminApi.post('/auth/logout'),
  me: () => adminApi.get('/auth/me'),
  refresh: (refreshToken) => adminApi.post('/auth/refresh', { refreshToken }),
  verifyMfa: (payload) => adminApi.post('/auth/mfa/verify', payload),
  permissions: () => adminApi.get('/auth/permissions'),
  sessions: () => adminApi.get('/auth/sessions'),
};