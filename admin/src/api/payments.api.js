import { adminApi } from './client.js';

export const paymentsApi = {
  list: (params) => adminApi.getPaged('/payments', { params }),
  get: (paymentId) => adminApi.get(`/payments/${paymentId}`),
  reconciliationHistory: (paymentId) =>
    adminApi.get(`/payments/${paymentId}/reconciliation`),
};