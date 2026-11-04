import { adminApi } from './client.js';

export const marketplaceEarningsApi = {
  list: (params) => adminApi.get('/marketplace/trader-earnings', { params }),
  markPaid: (earningId, payload) =>
    adminApi.post(`/marketplace/trader-earnings/${earningId}/mark-paid`, payload),
};
