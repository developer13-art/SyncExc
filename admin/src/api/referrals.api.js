import { adminApi } from './client.js';

export const referralsApi = {
  policies: (params) => adminApi.getPaged('/referrals/policies', { params }),
  getPolicy: (policyId) => adminApi.get(`/referrals/policies/${policyId}`),
  createPolicy: (payload) => adminApi.post('/referrals/policies', payload),
  updatePolicy: (policyId, payload) =>
    adminApi.patch(`/referrals/policies/${policyId}`, payload),
  publishPolicy: (policyId, payload) =>
    adminApi.post(`/referrals/policies/${policyId}/publish`, payload),
  versions: (policyId) => adminApi.get(`/referrals/policies/${policyId}/versions`),

  commissions: (params) => adminApi.getPaged('/referrals/commissions', { params }),
  getCommission: (commissionId) => adminApi.get(`/referrals/commissions/${commissionId}`),

  payouts: (params) => adminApi.getPaged('/referrals/payouts', { params }),
  getPayout: (payoutId) => adminApi.get(`/referrals/payouts/${payoutId}`),
  approvePayout: (payoutId, payload) =>
    adminApi.post(`/referrals/payouts/${payoutId}/approve`, payload),
  rejectPayout: (payoutId, payload) =>
    adminApi.post(`/referrals/payouts/${payoutId}/reject`, payload),
  reconcilePayout: (payoutId) =>
    adminApi.post(`/referrals/payouts/${payoutId}/reconcile`, {}),

  fraudCases: (params) => adminApi.getPaged('/referrals/fraud-cases', { params }),
  getFraudCase: (caseId) => adminApi.get(`/referrals/fraud-cases/${caseId}`),
  decideFraudCase: (caseId, payload) =>
    adminApi.post(`/referrals/fraud-cases/${caseId}/decisions`, payload),
};