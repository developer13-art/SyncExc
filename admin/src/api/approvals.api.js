import { adminApi } from './client.js';

export const approvalsApi = {
  list: (params) => adminApi.getPaged('/approvals', { params }),
  get: (approvalId) => adminApi.get(`/approvals/${approvalId}`),
  approve: (approvalId, payload) =>
    adminApi.post(`/approvals/${approvalId}/approve`, payload),
  reject: (approvalId, payload) =>
    adminApi.post(`/approvals/${approvalId}/reject`, payload),
  history: (approvalId) => adminApi.get(`/approvals/${approvalId}/history`),
};