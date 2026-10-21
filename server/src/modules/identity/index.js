/**
 * SyncExc Server — Identity module (Module 01)
 *
 * Owns:
 *   - registration and account creation
 *   - login and session management
 *   - MFA (TOTP enrollment and verification)
 *   - email verification
 *   - password change and reset
 *   - trusted devices
 *   - security events (append-only)
 *   - user profile reads/writes (non-security fields)
 *
 * Exposes a small surface for other modules:
 *   identity.getUserById(userId)
 *   identity.getUserByEmail(email)
 *   identity.isActive(userId)
 *   identity.touchSessionActivity(sessionId)
 *   identity.revokeAllSessions(userId, opts)
 */

import { createIdentityQueries } from './identity.queries.js';
import { createIdentityService } from './identity.service.js';
import { createIdentityRoutes } from './identity.routes.js';
import { createLogger } from '../../lib/logger.js';

export function createIdentityModule({ services }) {
  const logger = createLogger({ component: 'identity' });

  const queries = createIdentityQueries({ db: services.db });

  const service = createIdentityService({
    db: services.db,
    queries,
    rateLimiter: services.rateLimiter,
    mailer: services.mailer,
    push: services.push,
    events: services.events,
    audit: services.audit,
    idempotency: services.idempotency,
    profileImages: services.profileImages,
    logger,
  });

  const routes = createIdentityRoutes({ service, middleware: services.middleware });

  // Public API for other modules
  const publicApi = {
    getUserById: (userId) => service.getUserById(userId),
    getUserByEmail: (email) => service.getUserByEmail(email),
    isActive: (userId) => service.isActive(userId),
    touchSessionActivity: (sessionId) => service.touchSessionActivity(sessionId),
    revokeAllSessions: (userId, opts) => service.revokeAllSessions(userId, opts),
    // Middleware helpers need a couple of these functions
    sessionService: {
      findActiveByTokenHash: (hash) => service.findActiveByTokenHash(hash),
      isStepUpFresh: (sessionId, opts) => service.isStepUpFresh(sessionId, opts),
    },
  };

  return {
    name: 'identity',
    routes,
    service,
    queries,
    publicApi,

    async shutdown() {
      logger.debug('Identity module shutdown');
    },
  };
}

export default createIdentityModule;