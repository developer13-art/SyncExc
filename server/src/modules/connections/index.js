/**
 * SyncExc Server — Connections module (Module 04)
 *
 * Owns:
 *   - exchange registry
 *   - connections and credentials (encrypted at rest)
 *   - credential rotation and validation
 *   - accounts and balances
 *   - instruments and capabilities
 *   - connection health monitoring
 *   - per-exchange request metrics
 *   - rate-limit coordination
 *   - exchange adapter framework (Binance, Bybit, Bitget, OKX)
 *
 * Public API:
 *   connections.getConnection(connectionId)
 *   connections.getActiveConnectionForAccount(accountId)
 *   connections.getAdapter(exchangeCode)
 *   connections.checkAccountAccess({ accountId, workspaceId, operation })
 *   connections.getInstrument({ exchangeCode, symbol })
 */

import { createConnectionsQueries } from './connections.queries.js';
import { createConnectionsService } from './connections.service.js';
import { createCredentialVault } from './credentials.service.js';
import { createConnectionsRoutes } from './connections.routes.js';
import { createAdapterRegistry } from './adapters/index.js';
import { createRateLimitCoordinator } from './rate-limit-coordinator.service.js';
import { createExchangeStreams } from './streams.js';
import { createLogger } from '../../lib/logger.js';

export function createConnectionsModule({ services }) {
  const logger = createLogger({ component: 'connections' });

  const queries = createConnectionsQueries({ db: services.db });
  const credentialVault = createCredentialVault({ logger });
  const adapterRegistry = createAdapterRegistry({ logger, config: services.config });
  const rateLimitCoordinator = createRateLimitCoordinator({ db: services.db, redis: services.redis, logger });

  const service = createConnectionsService({
    db: services.db,
    queries,
    redis: services.redis,
    credentialVault,
    adapterRegistry,
    rateLimitCoordinator,
    events: services.events,
    audit: services.audit,
    logger,
  });

  const streams = createExchangeStreams({
    db: services.db,
    queries,
    adapterRegistry,
    events: services.events,
    realtime: services.realtime,
    logger,
  });

  const routes = createConnectionsRoutes({ service, middleware: services.middleware });

  const publicApi = {
    getConnection: (connectionId) => service.getConnection(connectionId),
    getActiveConnectionForAccount: (accountId) => service.getActiveConnectionForAccount(accountId),
    getAdapter: (exchangeCode) => adapterRegistry.get(exchangeCode),
    checkAccountAccess: (params) => service.checkAccountAccess(params),
    getInstrument: (params) => service.getInstrument(params),
    loadCredentials: (connectionId) => service.loadCredentials(connectionId),
  };

  return {
    name: 'connections',
    routes,
    service,
    queries,
    adapterRegistry,
    credentialVault,
    rateLimitCoordinator,
    streams,
    publicApi,

    async shutdown() {
      logger.info('Shutting down connections module');
      await streams.shutdown();
    },
  };
}

export default createConnectionsModule;