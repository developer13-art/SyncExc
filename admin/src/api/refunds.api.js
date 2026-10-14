import { adminApi } from './client.js';

export const refundsApi = {
  list: (params) => adminApi.getPaged('/refunds', { params }),
  get: (refundId) => adminApi.get(`/refunds/${refundId}`),
  initiate: (paymentId, payload) =>
    adminApi.post(`/payments/${paymentId}/refund-requests`, payload),
  approve: (refundId, payload) => adminApi.post(`/refunds/${refundId}/approve`, payload),
  reject: (refundId, payload) => adminApi.post(`/refunds/${refundId}/reject`, payload),
  reconcile: (refundId) => adminApi.post(`/refunds/${refundId}/reconcile`),
};