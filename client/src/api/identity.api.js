import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const identityApi = {
  register: (payload) => api.post(endpoints.auth.register, payload),

  login: (payload) => api.post(endpoints.auth.login, payload),

  logout: () => api.post(endpoints.auth.logout),

  logoutAll: () => api.post(`${endpoints.auth.logout}/all`),

  refresh: (refreshToken) => api.post(endpoints.auth.refresh, { refreshToken }),

  getCurrentUser: () => api.get(endpoints.auth.me),

  verifyEmail: (token) => api.post(endpoints.auth.verifyEmail, { token }),

  resendVerification: (email) => api.post(endpoints.auth.resendVerification, { email }),

  forgotPassword: (email) => api.post(endpoints.auth.forgotPassword, { email }),

  resetPassword: (payload) => api.post(endpoints.auth.resetPassword, payload),

  changePassword: (payload) => api.post(endpoints.auth.changePassword, payload),

  getMfaStatus: () => api.get(endpoints.auth.mfaStatus),

  enrollMfa: () => api.post(endpoints.auth.mfaEnroll),

  confirmMfaEnrollment: (payload) => api.post(endpoints.auth.mfaConfirm, payload),

  verifyMfa: (payload) => api.post(endpoints.auth.mfaVerify, payload),

  disableMfa: (payload) => api.post(endpoints.auth.mfaDisable, payload),

  regenerateRecoveryCodes: (payload) =>
    api.post(endpoints.auth.regenerateRecoveryCodes, payload),

  getProfile: () => api.get(endpoints.users.me),

  updateProfile: (payload) => api.patch(endpoints.users.me, payload),

  changeEmail: (payload) => api.post(endpoints.users.changeEmail, payload),

  listSessions: () => api.get(endpoints.users.sessions),

  revokeSession: (sessionId) => api.delete(endpoints.users.session(sessionId)),

  listTrustedDevices: () => api.get(endpoints.users.trustedDevices),

  revokeTrustedDevice: (deviceId) => api.delete(endpoints.users.trustedDevice(deviceId)),

  getSecurityEvents: (params) => api.getPaged(endpoints.users.securityEvents, { params }),

  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.upload(`${endpoints.users.me}/avatar`, formData);
  },

  removeAvatar: () => api.delete(`${endpoints.users.me}/avatar`),
};