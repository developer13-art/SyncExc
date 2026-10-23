/**
 * SyncExc Server — Terminal module (Module 05)
 *
 * Owns:
 *   - order submission (validated + risk-checked + idempotent)
 *   - order management (cancel, list, detail)
 *   - positions and trade history
 *   - execution status timeline
 *   - portfolio aggregation
 *   - saved views and terminal preferences
 *
 * Public API:
 *   terminal.getOrder(orderId)
 *   terminal.submitOrder(params)
 *   terminal.listOrdersForScope({ workspaceId, ... })
 */

import { createTerminalQueries } from './terminal.queries.js';
import { createTerminalService } from './terminal.service.js';
import { createOrderSubmissionService } from './order-submission.service.js';
import { createExecutionService } from './execution.service.js';
import { createPortfolioService } from './portfolio.service.js';
import { createTerminalRoutes } from './terminal.routes.js';
import { createLogger } from '../../lib/logger.js';

export function createTerminalModule({ services }) {
  const logger = createLogger({ component: 'terminal' });

  const queries = createTerminalQueries({ db: services.db });

  const executionService = createExecutionService({
    db: services.db,
    queries,
    events: services.events,
    realtime: services.realtime,
    logger,
  });

  const service = createTerminalService({
    db: services.db,
    queries,
    marketData: services.connections.marketData,
    connections: services.connections,
    executionService,
    events: services.events,
    audit: services.audit,
    logger,
  });

  const portfolioService = createPortfolioService({
    db: services.db,
    queries,
    marketData: services.connections.marketData,
    logger,
  });

  const orderSubmissionService = createOrderSubmissionService({
    db: services.db,
    queries,
    connections: services.connections,
    risk: services.risk,
    executionService,
    events: services.events,
    idempotency: services.idempotency,
    logger,
  });

  const routes = createTerminalRoutes({
    service,
    orderSubmissionService,
    executionService,
    portfolioService,
    middleware: services.middleware,
  });

  const publicApi = {
    getOrder: (orderId) => service.getOrder(orderId),
    submitOrder: (params, options) => orderSubmissionService.submit(params, options),
    confirmExecution: (params) => orderSubmissionService.confirm(params),
    listOrdersForScope: (params) => service.listOrdersForScope(params),
    recordExecutionUpdate: (params) => executionService.handleExecutionUpdate(params),
  };

  return {
    name: 'terminal',
    routes,
    service,
    queries,
    orderSubmissionService,
    executionService,
    portfolioService,
    publicApi,

    async shutdown() {
      logger.debug('Terminal module shutdown');
    },
  };
}

export default createTerminalModule;