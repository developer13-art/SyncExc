import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const developerApi = {
  listApplications: (params) =>
    api.getPaged(endpoints.developer.applications, { params }),

  createApplication: (payload) => api.post(endpoints.developer.applications, payload),

  getApplication: (applicationId) =>
    api.get(endpoints.developer.application(applicationId)),

  updateApplication: (applicationId, payload) =>
    api.patch(endpoints.developer.application(applicationId), payload),

  deleteApplication: (applicationId) =>
    api.delete(endpoints.developer.application(applicationId)),

  listCredentials: (applicationId) =>
    api.get(endpoints.developer.credentials(applicationId)),

  createCredential: (applicationId, payload) =>
    api.post(endpoints.developer.credentials(applicationId), payload),

  rotateCredential: (applicationId, credentialId, payload) =>
    api.post(
      endpoints.developer.rotateCredential(applicationId, credentialId),
      payload,
    ),

  revokeCredential: (applicationId, credentialId) =>
    api.delete(endpoints.developer.revokeCredential(applicationId, credentialId)),

  listWebhooks: (applicationId) => api.get(endpoints.developer.webhooks(applicationId)),

  createWebhook: (applicationId, payload) =>
    api.post(endpoints.developer.webhooks(applicationId), payload),

  getWebhook: (applicationId, subscriptionId) =>
    api.get(endpoints.developer.webhook(applicationId, subscriptionId)),

  updateWebhook: (applicationId, subscriptionId, payload) =>
    api.patch(endpoints.developer.webhook(applicationId, subscriptionId), payload),

  deleteWebhook: (applicationId, subscriptionId) =>
    api.delete(endpoints.developer.webhook(applicationId, subscriptionId)),

  listWebhookDeliveries: (applicationId, subscriptionId, params) =>
    api.getPaged(endpoints.developer.webhookDeliveries(applicationId, subscriptionId), {
      params,
    }),

  replayDelivery: (applicationId, subscriptionId, payload) =>
    api.post(
      endpoints.developer.replayDelivery(applicationId, subscriptionId),
      payload,
    ),

  rotateWebhookSecret: (applicationId, subscriptionId) =>
    api.post(
      `${endpoints.developer.webhook(applicationId, subscriptionId)}/rotate-secret`,
    ),

  getUsage: (applicationId, params) =>
    api.get(endpoints.developer.usage(applicationId), { params }),

  listSandboxSessions: (applicationId) =>
    api.get(endpoints.developer.sandboxSessions(applicationId)),

  createSandboxSession: (applicationId, payload) =>
    api.post(endpoints.developer.sandboxSessions(applicationId), payload),

  listTestRuns: (applicationId, params) =>
    api.getPaged(endpoints.developer.testRuns(applicationId), { params }),

  createTestRun: (applicationId, payload) =>
    api.post(endpoints.developer.testRuns(applicationId), payload),

  listOAuthClients: (applicationId) =>
    api.get(endpoints.developer.oauthClients(applicationId)),

  listOAuthGrants: (applicationId) =>
    api.get(endpoints.developer.oauthGrants(applicationId)),

  revokeOAuthGrant: (applicationId, grantId) =>
    api.delete(`${endpoints.developer.oauthGrants(applicationId)}/${grantId}`),

  listApiVersions: () => api.get(endpoints.developer.apiVersions),
};