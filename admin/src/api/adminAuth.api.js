import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const adminAuthApi = {
  login: (payload) => api.post(endpoints.auth.login, payload),
  logout: () => api.post(endpoints.auth.logout),
  refresh: (refreshToken) => api.post(endpoints.auth.refresh, { refreshToken }),
  me: () => api.get(endpoints.auth.me),
  verifyMfa: (payload) => api.post(endpoints.auth.mfaVerify, payload),
  stepUp: (payload) => api.post(endpoints.auth.stepUp, payload),
};