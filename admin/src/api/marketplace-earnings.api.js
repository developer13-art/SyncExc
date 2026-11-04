import { adminApi } from './client.js';

export const marketplaceEarningsApi = {
  list: (params) => adminApi.get('/marketplace/trader-earnings', { params }),
  listRequests: (params) => adminApi.get('/marketplace/trader-payout-requests', { params }),
  listSubscriptions: (params) => adminApi.get('/marketplace/trader-subscriptions', { params }),
  listPlans: (params) => adminApi.get('/marketplace/trader-plans', { params }),
  listTraders: (params) => adminApi.get('/marketplace/traders', { params }),
  createPlan: (payload) => adminApi.post('/marketplace/trader-plans', payload),
  setPlanStatus: (planId, status) =>
    adminApi.patch(`/marketplace/trader-plans/${planId}/status`, { status }),
  markPaid: (earningId, payload) =>
    adminApi.post(`/marketplace/trader-earnings/${earningId}/mark-paid`, payload),
  markRequestPaid: (requestId, payload) =>
    adminApi.post(`/marketplace/trader-payout-requests/${requestId}/mark-paid`, payload),
  rejectRequest: (requestId, payload) =>
    adminApi.post(`/marketplace/trader-payout-requests/${requestId}/reject`, payload),
};
