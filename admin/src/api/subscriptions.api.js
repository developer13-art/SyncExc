import { adminApi } from './client.js';

export const subscriptionsApi = {
  list: (params) => adminApi.getPaged('/subscriptions', { params }),
  get: (subscriptionId) => adminApi.get(`/subscriptions/${subscriptionId}`),
  history: (subscriptionId, params) =>
    adminApi.getPaged(`/subscriptions/${subscriptionId}/history`, { params }),
  correctState: (subscriptionId, payload) =>
    adminApi.post(`/subscriptions/${subscriptionId}/corrections`, payload),
  applyCredit: (subscriptionId, payload) =>
    adminApi.post(`/subscriptions/${subscriptionId}/credits`, payload),
  schedulePlanChange: (subscriptionId, payload) =>
    adminApi.post(`/subscriptions/${subscriptionId}/change-plan`, payload),
};