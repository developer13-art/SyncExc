/**
 * SyncExc Server — Workspaces module (Module 03)
 *
 * Owns:
 *   - personal and organization workspaces
 *   - memberships and invitations
 *   - roles and permission catalog
 *   - connection-sharing grants
 *   - ownership transfers
 *   - workspace-scoped audit events
 *
 * Public API used across the platform:
 *   workspaces.getWorkspaceById(id)
 *   workspaces.getMembership({ userId, workspaceId })
 *   workspaces.getEffectivePermissions({ userId, workspaceId })
 *   workspaces.ensurePersonalWorkspace(userId)
 *   workspaces.hasPermission({ userId, workspaceId, permission })
 *   workspaces.getActiveWorkspaceIdsForUser(userId)
 */

import { createWorkspacesQueries } from './workspaces.queries.js';
import { createWorkspacesService } from './workspaces.service.js';
import { createWorkspacesRoutes } from './workspaces.routes.js';
import { createLogger } from '../../lib/logger.js';

export function createWorkspacesModule({ services }) {
  const logger = createLogger({ component: 'workspaces' });

  const queries = createWorkspacesQueries({ db: services.db });

  const service = createWorkspacesService({
    db: services.db,
    queries,
    rateLimiter: services.rateLimiter,
    mailer: services.mailer,
    events: services.events,
    audit: services.audit,
    logger,
  });

  const routes = createWorkspacesRoutes({ service, middleware: services.middleware });

  const publicApi = {
    getWorkspaceById: (id) => service.getWorkspaceById(id),
    getMembership: (params) => service.getMembership(params),
    getEffectivePermissions: (params) => service.getEffectivePermissions(params),
    ensurePersonalWorkspace: (userId) => service.ensurePersonalWorkspace(userId),
    hasPermission: (params) => service.hasPermission(params),
    getActiveWorkspaceIdsForUser: (userId) => service.getActiveWorkspaceIdsForUser(userId),
  };

  return {
    name: 'workspaces',
    routes,
    service,
    queries,
    publicApi,

    async shutdown() {
      logger.debug('Workspaces module shutdown');
    },
  };
}

export default createWorkspacesModule;