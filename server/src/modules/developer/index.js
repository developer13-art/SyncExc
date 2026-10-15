/**
 * SyncExc Server — Developer module (Module 14)
 *
 * Owns:
 *   - application registration and lifecycle
 *   - API credential creation, rotation, revocation
 *   - OAuth 2.0 authorization flows (PKCE + client credentials)
 *   - scoped access control
 *   - webhook subscriptions, signing, delivery, retry, replay
 *   - API usage analytics and rate limits
 *   - sandbox environment
 *
 * Public API:
 *   developer.authenticateApiRequest(req)
 *   developer.webhooks.deliver(deliveryId)
 *   developer.usage.record(params)
 */

import { createDeveloperQueries } from './developer.queries.js';
import { createApplicationService } from './application.service.js';
import { createCredentialService } from './credential.service.js';
import { createOAuthService } from './oauth.js';
import { createWebhookSubscriptionService } from './webhook-subscription.service.js';
import { createWebhookDeliveryService } from './webhook-delivery.service.js';
import { createUsageAnalyticsService } from './usage-analytics.service.js';
import { createSandboxService } from './sandbox.service.js';
import { createApiAuthorizationService } from './api-authorization.service.js';
import { createDeveloperRoutes } from './developer.routes.js';
import { createPublicApiRoutes } from './public-api.routes.js';
import { createDeveloperListeners } from './listeners.js';
import { createLogger } from '../../lib/logger.js';

export function createDeveloperModule({ services }) {
  const logger = createLogger({ component: 'developer' });

  const queries = createDeveloperQueries({ db: services.db });

  const applicationService = createApplicationService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const credentialService = createCredentialService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const oauthService = createOAuthService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const webhookSubscriptionService = createWebhookSubscriptionService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const webhookDeliveryService = createWebhookDeliveryService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const usageAnalyticsService = createUsageAnalyticsService({
    db: services.db,
    queries,
    logger,
  });

  const sandboxService = createSandboxService({
    db: services.db,
    queries,
    logger,
  });

  const apiAuthorizationService = createApiAuthorizationService({
    db: services.db,
    queries,
    credentialService,
    oauthService,
    usageAnalyticsService,
    logger,
  });

  const adminRoutes = createDeveloperRoutes({
    applicationService,
    credentialService,
    oauthService,
    webhookSubscriptionService,
    webhookDeliveryService,
    usageAnalyticsService,
    sandboxService,
    middleware: services.middleware,
  });

  const publicRoutes = createPublicApiRoutes({
    apiAuthorization: apiAuthorizationService,
    services,
  });

  const listeners = createDeveloperListeners({
    events: services.events,
    webhookSubscriptionService,
    webhookDeliveryService,
    usageAnalyticsService,
    logger,
  });

  const publicApi = {
    async authenticateApiRequest(req) {
      return apiAuthorizationService.authenticate(req);
    },
    webhooks: {
      deliver: (deliveryId) => webhookDeliveryService.deliver(deliveryId),
    },
    usage: {
      record: (params) => usageAnalyticsService.recordRequest(params),
    },
  };

  return {
    name: 'developer',
    routes: { admin: adminRoutes, public: publicRoutes },
    queries,
    application: applicationService,
    credential: credentialService,
    oauth: oauthService,
    webhooks: webhookSubscriptionService,
    webhookDelivery: webhookDeliveryService,
    usage: usageAnalyticsService,
    sandbox: sandboxService,
    apiAuthorization: apiAuthorizationService,
    publicApi,

    async shutdown() {
      logger.debug('Developer module shutdown');
    },
  };
}

export default createDeveloperModule;