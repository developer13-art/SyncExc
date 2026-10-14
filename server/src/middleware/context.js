/**
 * SyncExc Server — Request context middleware
 *
 * Populates three context objects on every request:
 *
 *   req.correlation  { id, requestId }
 *   req.auth         { userId, sessionId, isAuthenticated, isStepUp }
 *   req.workspace    { id, role, permissions, member }
 *
 * These are read by authorization, service calls, logging, and audit.
 * Context is built from headers and cookies; it does not hit the DB.
 * Session verification is a separate middleware (`auth.js`) because some
 * routes are public.
 */

import { getCorrelation } from '../lib/correlation.js';

export function applyContextMiddleware(app, services) {
  app.use((req, res, next) => {
    // Correlation context
    const incomingCorrelation = req.headers['x-correlation-id'];
    req.correlation = {
      id:
        typeof incomingCorrelation === 'string' && incomingCorrelation.length <= 128
          ? incomingCorrelation
          : req.id,
      requestId: req.id,
    };
    res.setHeader('X-Correlation-Id', req.correlation.id);

    // Auth context — populated by `auth.js` if the request is authenticated.
    req.auth = {
      userId: null,
      sessionId: null,
      isAuthenticated: false,
      isStepUp: false,
      stepUpAt: null,
    };

    // Workspace context — populated by workspace middleware when relevant.
    req.workspace = {
      id: null,
      role: null,
      permissions: [],
      member: null,
    };

    // Attach services so route handlers don't need to import them.
    req.services = services;

    next();
  });
}

export default applyContextMiddleware;