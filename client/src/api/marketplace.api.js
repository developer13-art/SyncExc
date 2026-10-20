import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const marketplaceApi = {
  listProviders: (params) => api.getPaged(endpoints.marketplace.providers, { params }),

  getMyProvider: () => api.get(endpoints.marketplace.myProvider),

  createProvider: (payload) => api.post(endpoints.marketplace.providers, payload),

  publishProviderProfile: (providerId, payload) =>
    api.patch(endpoints.marketplace.provider(providerId), payload),

  getProvider: (providerId) => api.get(endpoints.marketplace.provider(providerId)),

  updateProvider: (providerId, payload) =>
    api.patch(endpoints.marketplace.provider(providerId), payload),

  listProviderSignals: (providerId, params) =>
    api.getPaged(endpoints.marketplace.providerSignals(providerId), { params }),

  listProviderPlans: (providerId) =>
    api.get(endpoints.marketplace.providerPlans(providerId)),

  getProviderPerformance: (providerId, params) =>
    api.get(endpoints.marketplace.providerPerformance(providerId), { params }),

  getProviderDisclosures: (providerId) =>
    api.get(endpoints.marketplace.providerDisclosures(providerId)),

  getProviderSubscribers: (providerId, params) =>
    api.getPaged(endpoints.marketplace.providerSubscribers(providerId), { params }),

  getProviderDashboard: (params) =>
    api.get(endpoints.marketplace.providerDashboard, { params }),

  getMySubscribers: (params) =>
    api.getPaged(endpoints.marketplace.mySubscribers, { params }),

  getMyProviderPlans: () =>
    api.get(endpoints.marketplace.myPlans),

  createMyProviderPlan: (payload) =>
    api.post(endpoints.marketplace.myPlans, payload),

  updateMyProviderPlan: (planId, payload) =>
    api.patch(`${endpoints.marketplace.myPlans}/${planId}`, payload),

  getSubscriberDashboard: () => api.get(endpoints.marketplace.subscriberDashboard),

  followProvider: (providerId, payload) =>
    api.post(endpoints.marketplace.follow(providerId), payload),

  unfollowProvider: (providerId) =>
    api.delete(endpoints.marketplace.follow(providerId)),

  listFollows: (params) => api.getPaged(endpoints.marketplace.follows, { params }),

  listSubscriptions: (params) =>
    api.getPaged(endpoints.marketplace.subscriptions, { params }),

  createSubscription: (payload) => api.post(endpoints.marketplace.subscriptions, payload),

  getSubscription: (subscriptionId) =>
    api.get(endpoints.marketplace.subscription(subscriptionId)),

  cancelSubscription: (subscriptionId, payload) =>
    api.post(endpoints.marketplace.cancelSubscription(subscriptionId), payload),

  listPublishedSignals: (params) =>
    api.getPaged(endpoints.marketplace.signals, { params }),

  listMySignals: (params) =>
    api.getPaged(endpoints.marketplace.mySignals, { params }),

  publishSignal: (payload) => api.post(endpoints.marketplace.mySignals, payload),

  updateSignal: (signalId, payload) =>
    api.patch(endpoints.marketplace.signal(signalId), payload),

  cancelPublishedSignal: (signalId, payload) =>
    api.post(endpoints.marketplace.cancelSignal(signalId), payload),

  getPublishedSignalHistory: (signalId) =>
    api.get(endpoints.marketplace.signalHistory(signalId)),

  listCopyConfigurations: (params) =>
    api.getPaged(endpoints.marketplace.copyConfigurations, { params }),

  createCopyConfiguration: (payload) =>
    api.post(endpoints.marketplace.copyConfigurations, payload),

  getCopyConfiguration: (configId) =>
    api.get(endpoints.marketplace.copyConfiguration(configId)),

  updateCopyConfiguration: (configId, payload) =>
    api.patch(endpoints.marketplace.copyConfiguration(configId), payload),

  validateCopyConfiguration: (configId) =>
    api.post(endpoints.marketplace.validateCopyConfig(configId)),

  activateCopyConfiguration: (configId, payload) =>
    api.post(endpoints.marketplace.activateCopyConfig(configId), payload),

  pauseCopyConfiguration: (configId, payload) =>
    api.post(endpoints.marketplace.pauseCopyConfig(configId), payload),

  resumeCopyConfiguration: (configId, payload) =>
    api.post(endpoints.marketplace.resumeCopyConfig(configId), payload),

  revokeCopyConfiguration: (configId, payload) =>
    api.post(endpoints.marketplace.revokeCopyConfig(configId), payload),

  getCopyConfigurationHistory: (configId, params) =>
    api.getPaged(endpoints.marketplace.copyConfigHistory(configId), { params }),

  listCopySignalResults: (params) =>
    api.getPaged(endpoints.marketplace.copySignalResults, { params }),

  getCopySignalResult: (resultId) =>
    api.get(endpoints.marketplace.copySignalResult(resultId)),

  listModerationCases: (params) =>
    api.getPaged(endpoints.marketplace.moderationCases, { params }),

  getModerationCase: (caseId) =>
    api.get(endpoints.marketplace.moderationCase(caseId)),

  getAudit: (params) => api.getPaged(endpoints.marketplace.audit, { params }),
};