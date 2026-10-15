/**
 * SyncExc Server — Developer controller
 */

import { success, created, paginated } from '../../lib/response.js';
import {
  serializeDeveloperApplication,
  serializeApiCredential,
  serializeWebhookSubscription,
} from '../../lib/serializers.js';

export function createDeveloperController(services) {
  const {
    applicationService,
    credentialService,
    oauthService,
    webhookSubscriptionService,
    webhookDeliveryService,
    usageAnalyticsService,
    sandboxService,
  } = services;

  return {
    /* Applications */
    async listApplications(req, res) {
      const apps = await applicationService.listApplications({
        workspaceId: req.workspace.id,
        state: req.query.state,
      });
      return success(res, apps.map(serializeDeveloperApplication));
    },

    async createApplication(req, res) {
      const app = await applicationService.createApplication({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        name: req.body.name,
        description: req.body.description,
        type: req.body.type,
        redirectUris: req.body.redirectUris,
        website: req.body.website,
        privacyPolicyUrl: req.body.privacyPolicyUrl,
        supportContact: req.body.supportContact,
      });
      return created(res, serializeDeveloperApplication(app));
    },

    async getApplication(req, res) {
      const app = await applicationService.getApplication({
        applicationId: req.params.applicationId,
        workspaceId: req.workspace.id,
      });
      return success(res, serializeDeveloperApplication(app));
    },

    async updateApplication(req, res) {
      const app = await applicationService.updateApplication({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        applicationId: req.params.applicationId,
        updates: req.body,
      });
      return success(res, serializeDeveloperApplication(app));
    },

    async suspendApplication(req, res) {
      const app = await applicationService.suspendApplication({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        applicationId: req.params.applicationId,
        reason: req.body.reason,
      });
      return success(res, serializeDeveloperApplication(app));
    },

    /* Credentials */
    async listCredentials(req, res) {
      const creds = await credentialService.listCredentials({
        applicationId: req.params.applicationId,
        workspaceId: req.workspace.id,
      });
      return success(res, creds.map(serializeApiCredential));
    },

    async createCredential(req, res) {
      const result = await credentialService.createCredential({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        applicationId: req.params.applicationId,
        environment: req.body.environment,
        scopes: req.body.scopes,
        expiresInDays: req.body.expiresInDays,
      });
      return created(res, {
        credential: serializeApiCredential(result.credential),
        plaintext: result.plaintext,
        warning: 'Store this token securely. It will not be shown again.',
      });
    },

    async revokeCredential(req, res) {
      const result = await credentialService.revokeCredential({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        credentialId: req.params.credentialId,
        reason: req.body.reason,
      });
      return success(res, serializeApiCredential(result));
    },

    async rotateCredential(req, res) {
      const result = await credentialService.rotateCredential({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        credentialId: req.params.credentialId,
        expiresInDays: req.body.expiresInDays,
      });
      return success(res, {
        newCredential: serializeApiCredential(result.newCredential),
        plaintext: result.plaintext,
        oldCredentialId: result.oldCredentialId,
        overlapExpiresAt: result.overlapExpiresAt,
      });
    },

    /* OAuth */
    async registerOauthClient(req, res) {
      const result = await oauthService.registerClient({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        applicationId: req.params.applicationId,
        redirectUris: req.body.redirectUris,
      });
      return created(res, {
        client: {
          clientId: result.client.client_id,
          redirectUris: result.client.redirect_uris,
        },
        clientSecret: result.clientSecret,
        warning: 'Store the client secret securely. It will not be shown again.',
      });
    },

    async createAuthorizationCode(req, res) {
      const result = await oauthService.createAuthorizationCode({
        clientId: req.body.clientId,
        userId: req.auth.userId,
        workspaceId: req.workspace?.id || null,
        redirectUri: req.body.redirectUri,
        scopes: req.body.scopes,
        codeChallenge: req.body.codeChallenge,
        codeChallengeMethod: req.body.codeChallengeMethod,
      });
      return created(res, result);
    },

    async exchangeAuthorizationCode(req, res) {
      const result = await oauthService.exchangeAuthorizationCode({
        clientId: req.body.clientId,
        code: req.body.code,
        redirectUri: req.body.redirectUri,
        codeVerifier: req.body.codeVerifier,
      });
      return success(res, result);
    },

    async exchangeRefreshToken(req, res) {
      const result = await oauthService.exchangeRefreshToken({
        clientId: req.body.clientId,
        refreshToken: req.body.refreshToken,
      });
      return success(res, result);
    },

    async clientCredentials(req, res) {
      const result = await oauthService.clientCredentials({
        clientId: req.body.clientId,
        clientSecret: req.body.clientSecret,
        scopes: req.body.scopes,
      });
      return success(res, result);
    },

    async listOauthGrants(req, res) {
      const grants = await oauthService.listGrantsForUser(req.auth.userId);
      return success(res, grants);
    },

    async revokeOauthGrant(req, res) {
      const result = await oauthService.revokeGrant({
        userId: req.auth.userId,
        grantId: req.params.grantId,
      });
      return success(res, result);
    },

    /* Webhooks */
    async listWebhooks(req, res) {
      const subs = await webhookSubscriptionService.listSubscriptions({
        applicationId: req.params.applicationId,
        workspaceId: req.workspace.id,
      });
      return success(res, subs.map(serializeWebhookSubscription));
    },

    async createWebhook(req, res) {
      const result = await webhookSubscriptionService.createSubscription({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        applicationId: req.params.applicationId,
        destinationUrl: req.body.destinationUrl,
        eventTypes: req.body.eventTypes,
        resourceFilters: req.body.resourceFilters,
      });
      return created(res, {
        subscription: serializeWebhookSubscription(result.subscription),
        signingSecret: result.signingSecret,
        warning: 'Store the signing secret securely. It will not be shown again.',
      });
    },

    async getWebhook(req, res) {
      const sub = await webhookSubscriptionService.getSubscription({
        subscriptionId: req.params.subscriptionId,
        workspaceId: req.workspace.id,
      });
      return success(res, serializeWebhookSubscription(sub));
    },

    async updateWebhook(req, res) {
      const sub = await webhookSubscriptionService.updateSubscription({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        subscriptionId: req.params.subscriptionId,
        updates: req.body,
      });
      return success(res, serializeWebhookSubscription(sub));
    },

    async deleteWebhook(req, res) {
      const sub = await webhookSubscriptionService.deleteSubscription({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        subscriptionId: req.params.subscriptionId,
      });
      return success(res, serializeWebhookSubscription(sub));
    },

    async rotateWebhookSecret(req, res) {
      const result = await webhookSubscriptionService.rotateSecret({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        subscriptionId: req.params.subscriptionId,
      });
      return success(res, result);
    },

    async listDeliveries(req, res) {
      const deliveries = await webhookDeliveryService.listDeliveries({
        subscriptionId: req.params.subscriptionId,
        workspaceId: req.workspace.id,
        limit: Number(req.query.limit) || 100,
      });
      return success(res, deliveries);
    },

    async getDelivery(req, res) {
      const result = await webhookDeliveryService.getDelivery({
        deliveryId: req.params.deliveryId,
        workspaceId: req.workspace.id,
      });
      return success(res, result);
    },

    async replayDelivery(req, res) {
      const result = await webhookDeliveryService.replayDelivery({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        deliveryId: req.params.deliveryId,
      });
      return success(res, result);
    },

    /* Usage */
    async getUsageSummary(req, res) {
      const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const summary = await usageAnalyticsService.getSummary({
        applicationId: req.params.applicationId,
        workspaceId: req.workspace.id,
        since,
        until: req.query.until ? new Date(req.query.until) : null,
      });
      return success(res, summary);
    },

    async getUsageByEndpoint(req, res) {
      const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const breakdown = await usageAnalyticsService.getByEndpoint({
        applicationId: req.params.applicationId,
        workspaceId: req.workspace.id,
        since,
      });
      return success(res, breakdown);
    },

    /* Sandbox */
    async createSandboxSession(req, res) {
      const session = await sandboxService.createSandboxSession({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        applicationId: req.params.applicationId,
      });
      return created(res, session);
    },

    async getSandboxFixtures(req, res) {
      const fixtures = await sandboxService.getFixtures({
        sessionRef: req.params.sessionRef,
        resourceType: req.query.resourceType,
      });
      return success(res, fixtures);
    },

    async simulateWebhook(req, res) {
      const result = await sandboxService.simulateWebhookEvent({
        sessionRef: req.body.sessionRef,
        subscriptionId: req.body.subscriptionId,
        eventType: req.body.eventType,
      });
      return created(res, result);
    },
  };
}

export default createDeveloperController;