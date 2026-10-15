/**
 * SyncExc Server — Platform Incidents module
 *
 * Cross-cutting incident management:
 *   - incident lifecycle (investigating → identified → monitoring → resolved)
 *   - incident events (timeline)
 *   - incident comments (internal vs customer-facing)
 *   - ticket linkage
 *   - affected workspace tracking
 *   - status page rendering support
 *
 * Public API:
 *   incidents.service.create(params)
 *   incidents.service.resolve(incidentId)
 *   incidents.service.addEvent(params)
 */

import { createIncidentsQueries } from './incidents.queries.js';
import { createIncidentService } from './incidents.service.js';
import { createIncidentRoutes } from './incidents.routes.js';
import { createLogger } from '../../lib/logger.js';

export function createIncidentsModule({ services }) {
  const logger = createLogger({ component: 'incidents' });

  const queries = createIncidentsQueries({ db: services.db });

  const incidentService = createIncidentService({
    db: services.db,
    queries,
    events: services.events,
    realtime: services.realtime,
    notifications: services.notifications,
    logger,
  });

  const routes = createIncidentRoutes({
    incidentService,
    middleware: services.middleware,
  });

  const publicApi = {
    service: {
      create: (params) => incidentService.createIncident(params),
      resolve: (incidentId) => incidentService.resolveIncident(incidentId),
      addEvent: (params) => incidentService.addEvent(params),
    },
  };

  return {
    name: 'incidents',
    routes,
    queries,
    service: incidentService,
    publicApi,

    async shutdown() {
      logger.debug('Incidents module shutdown');
    },
  };
}

export default createIncidentsModule;