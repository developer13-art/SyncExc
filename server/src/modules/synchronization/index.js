/**
 * SyncExc Server — Synchronization module (Module 06)
 *
 * Owns:
 *   - sync groups and destinations
 *   - event subscriptions
 *   - instrument mappings
 *   - sizing policies
 *   - source event ingestion and normalization
 *   - deduplication
 *   - operation orchestration
 *   - partial failure handling
 *   - retries and reconciliation
 *
 * Public API:
 *   sync.ingestSourceEvent(event)
 *   sync.getOperation(operationId)
 *   sync.handleDestinationOutcome(params)
 */

import { createSyncQueries } from './synchronization.queries.js';
import { createSyncService } from './synchronization.service.js';
import { createOrchestrator } from './orchestrator.service.js';
import { createDispatcher } from './dispatcher.service.js';
import { createReconciliation } from './reconciliation.service.js';
import { createRetryScheduler } from './retry.service.js';
import { createSyncRoutes } from './synchronization.routes.js';
import { createLogger } from '../../lib/logger.js';

export function createSynchronizationModule({ services }) {
  const logger = createLogger({ component: 'sync' });

  const queries = createSyncQueries({ db: services.db });

  const service = createSyncService({
    db: services.db,
    queries,
    events: services.events,
    audit: services.audit,
    logger,
  });

  const retryScheduler = createRetryScheduler({
    db: services.db,
    queries,
    jobs: services.jobs,
    logger,
  });

  const dispatcher = createDispatcher({
    db: services.db,
    queries,
    connections: services.connections,
    terminal: services.terminal,
    risk: services.risk,
    retryScheduler,
    events: services.events,
    logger,
  });

  const orchestrator = createOrchestrator({
    db: services.db,
    queries,
    dispatcher,
    events: services.events,
    logger,
  });

  const reconciliation = createReconciliation({
    db: services.db,
    queries,
    connections: services.connections,
    terminal: services.terminal,
    events: services.events,
    logger,
  });

  const routes = createSyncRoutes({ service, orchestrator, reconciliation, middleware: services.middleware });

  return {
    name: 'synchronization',
    routes,
    service,
    queries,
    orchestrator,
    dispatcher,
    reconciliation,
    retryScheduler,
    publicApi: {
      ingestSourceEvent: (params) => orchestrator.ingestSourceEvent(params),
      getOperation: (id) => service.getOperation(id),
      handleDestinationOutcome: (params) => dispatcher.handleOutcome(params),
    },

    async shutdown() {
      logger.debug('Synchronization module shutdown');
    },
  };
}

export default createSynchronizationModule;