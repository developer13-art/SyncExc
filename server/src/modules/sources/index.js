/**
 * SyncExc Server — Sources module (Module 08)
 *
 * Owns:
 *   - source registry (register, edit, archive)
 *   - AI-assisted discovery and candidate review
 *   - source connections (Telegram, Discord, WhatsApp, Webhook, Website)
 *   - source validation, health, quality monitoring
 *   - source sharing between workspaces
 *   - parser definitions and sandbox testing
 *
 * Public API:
 *   sources.getSource(sourceId)
 *   sources.getSourceForWorkspace({ sourceId, workspaceId })
 *   sources.getActiveSourcesForWorkspace(workspaceId)
 *   sources.recordMessageIngested({ sourceId, messageId })
 */

import { createSourcesQueries } from './sources.queries.js';
import { createSourceRegistryService } from './source-registry.service.js';
import { createDiscoveryService } from './discovery.service.js';
import { createReviewService } from './review.service.js';
import { createValidationService } from './validation.js';
import { createHealthService } from './health.service.js';
import { createQualityService } from './quality.service.js';
import { createSandboxService } from './sandbox.service.js';
import { createSourceConnectionService } from './source-connection.service.js';
import { createTelegramAuthService } from './telegram-auth.service.js';
import { createDuplicateDetectionService } from './duplicate-detection.service.js';
import { createSourcesRoutes } from './sources.routes.js';
import { createSourceAdapterRegistry } from './adapters/index.js';
import { createSourcesListeners } from './listeners.js';
import { createLogger } from '../../lib/logger.js';

export function createSourcesModule({ services }) {
  const logger = createLogger({ component: 'sources' });

  const queries = createSourcesQueries({ db: services.db });

  const adapterRegistry = createSourceAdapterRegistry({
    logger,
    config: services.config,
    db: services.db,
  });

  const sourceRegistryService = createSourceRegistryService({
    db: services.db,
    queries,
    events: services.events,
    audit: services.audit,
    logger,
  });

  const duplicateDetectionService = createDuplicateDetectionService({
    db: services.db,
    queries,
    logger,
  });

  const discoveryService = createDiscoveryService({
    db: services.db,
    queries,
    ai: services.ai,
    adapterRegistry,
    events: services.events,
    logger,
  });

  const reviewService = createReviewService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const validationService = createValidationService({
    db: services.db,
    queries,
    adapterRegistry,
    events: services.events,
    logger,
  });

  const healthService = createHealthService({
    db: services.db,
    queries,
    adapterRegistry,
    events: services.events,
    logger,
  });

  const qualityService = createQualityService({
    db: services.db,
    queries,
    logger,
  });

  const sandboxService = createSandboxService({
    db: services.db,
    queries,
    adapterRegistry,
    logger,
  });

  const connectionService = createSourceConnectionService({
    db: services.db,
    queries,
    adapterRegistry,
    credentialVault: services.connections.credentialVault,
    config: services.config,
    events: services.events,
    logger,
  });

  const telegramAuthService = createTelegramAuthService({
    db: services.db,
    config: services.config,
    sourceRegistryService,
    connectionService,
    logger,
  });

  const routes = createSourcesRoutes({
    sourceRegistryService,
    discoveryService,
    reviewService,
    validationService,
    healthService,
    qualityService,
    sandboxService,
    connectionService,
    telegramAuthService,
    duplicateDetectionService,
    queries,
    middleware: services.middleware,
  });

  // Register event listeners
  const listeners = createSourcesListeners({
    events: services.events,
    sourcesQueries: queries,
    healthService,
    qualityService,
    logger,
  });

  const publicApi = {
    getSource: (sourceId) => sourceRegistryService.getSource(sourceId),
    getSourceForWorkspace: (params) => sourceRegistryService.getSourceForWorkspace(params),
    getActiveSourcesForWorkspace: (workspaceId) =>
      sourceRegistryService.getActiveSourcesForWorkspace(workspaceId),
    recordMessageIngested: (params) => qualityService.recordMessageIngested(params),
    getAdapter: (type) => adapterRegistry.get(type),
  };

  return {
    name: 'sources',
    routes,
    queries,
    registry: sourceRegistryService,
    discovery: discoveryService,
    review: reviewService,
    validation: validationService,
    health: healthService,
    quality: qualityService,
    sandbox: sandboxService,
    connections: connectionService,
    duplicates: duplicateDetectionService,
    adapterRegistry,
    publicApi,

    async shutdown() {
      logger.debug('Sources module shutdown');
    },
  };
}

export default createSourcesModule;
