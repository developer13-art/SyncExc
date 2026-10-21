/**
 * SyncExc Server — Marketplace module (Module 10)
 *
 * Owns:
 *   - provider profiles and moderation
 *   - published signals and version history
 *   - followers and marketplace subscriptions
 *   - copy configurations and destination accounts
 *   - copy orchestration (per-subscriber signal fanout)
 *   - performance reporting with methodology versioning
 *
 * Public API:
 *   marketplace.publication.publishSignal(params)
 *   marketplace.copyOrchestration.processPublishedSignal(params)
 *   marketplace.provider.getProvider(providerId)
 */

import { createMarketplaceQueries } from './marketplace.queries.js';
import { createProviderService } from './provider.service.js';
import { createPublicationService } from './publication.service.js';
import { createFollowService } from './follow.service.js';
import { createSubscriptionService } from './subscription.service.js';
import { createCopyConfigurationService } from './copy-configuration.service.js';
import { createCopyOrchestrationService } from './copy-orchestration.service.js';
import { createPerformanceService } from './performance.service.js';
import { createDisclosureService } from './disclosure.service.js';
import { createModerationService } from './moderation.service.js';
import { createMarketplaceRoutes } from './marketplace.routes.js';
import { createMarketplaceListeners } from './listeners.js';
import { createLogger } from '../../lib/logger.js';

export function createMarketplaceModule({ services }) {
  const logger = createLogger({ component: 'marketplace' });

  const queries = createMarketplaceQueries({ db: services.db });

  const providerService = createProviderService({
    db: services.db,
    queries,
    events: services.events,
    profileImages: services.profileImages,
    logger,
  });

  const disclosureService = createDisclosureService({
    db: services.db,
    queries,
    logger,
  });

  const publicationService = createPublicationService({
    db: services.db,
    queries,
    events: services.events,
    disclosureService,
    logger,
  });

  const followService = createFollowService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const subscriptionService = createSubscriptionService({
    db: services.db,
    queries,
    billing: services.billing,
    events: services.events,
    logger,
  });

  const copyConfigurationService = createCopyConfigurationService({
    db: services.db,
    queries,
    connections: services.connections,
    events: services.events,
    logger,
  });

  const performanceService = createPerformanceService({
    db: services.db,
    queries,
    logger,
  });

  const copyOrchestrationService = createCopyOrchestrationService({
    db: services.db,
    queries,
    subscriptionService,
    copyConfigurationService,
    risk: services.risk,
    events: services.events,
    logger,
  });

  const moderationService = createModerationService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const routes = createMarketplaceRoutes({
    providerService,
    publicationService,
    followService,
    subscriptionService,
    copyConfigurationService,
    copyOrchestrationService,
    performanceService,
    disclosureService,
    moderationService,
    middleware: services.middleware,
  });

  const listeners = createMarketplaceListeners({
    events: services.events,
    copyOrchestration: copyOrchestrationService,
    logger,
  });

  const publicApi = {
    provider: {
      getProvider: (providerId) => providerService.getProvider(providerId),
      getProviderForUser: (userId, workspaceId) => providerService.getProviderForUser(userId, workspaceId),
    },
    publication: {
      publishSignal: (params) => publicationService.publishSignal(params),
      updateSignal: (params) => publicationService.updateSignal(params),
      cancelSignal: (params) => publicationService.cancelSignal(params),
    },
    copyOrchestration: {
      processPublishedSignal: (params) =>
        copyOrchestrationService.processPublishedSignal(params),
    },
  };

  return {
    name: 'marketplace',
    routes,
    queries,
    provider: providerService,
    publication: publicationService,
    follow: followService,
    subscription: subscriptionService,
    copyConfiguration: copyConfigurationService,
    copyOrchestration: copyOrchestrationService,
    performance: performanceService,
    disclosure: disclosureService,
    moderation: moderationService,
    publicApi,

    async shutdown() {
      logger.debug('Marketplace module shutdown');
    },
  };
}

export default createMarketplaceModule;