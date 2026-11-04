import { adminApi } from './client.js';

export const marketplaceEarningsApi = {
  list: (params) => adminApi.get('/marketplace/trader-earnings', { params }),
  listRequests: (params) => adminApi.get('/marketplace/trader-payout-requests', { params }),
  listSubscriptions: (params) => adminApi.get('/marketplace/trader-subscriptions', { params }),
  markPaid: (earningId, payload) =>
    adminApi.post(`/marketplace/trader-earnings/${earningId}/mark-paid`, payload),
  markRequestPaid: (requestId, payload) =>
    adminApi.post(`/marketplace/trader-payout-requests/${requestId}/mark-paid`, payload),
  rejectRequest: (requestId, payload) =>
    adminApi.post(`/marketplace/trader-payout-requests/${requestId}/reject`, payload),
};
