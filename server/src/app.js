/**
 * SyncExc Server — Express application factory
 *
 * Builds the temporary health-only Express shell with:
 *   - security middleware (helmet, cors, compression)
 *   - request middleware (id, logger, parser, cookies)
 *   - request context (correlation ID)
 *   - liveness and readiness endpoints
 *   - an explicit unavailable response for API routes
 *   - 404 and error handlers
 */

import express from 'express';
import config from './config.js';
import { applySecurityMiddleware } from './middleware/security.js';
import { applyRequestMiddleware } from './middleware/request.js';
import { applyContextMiddleware } from './middleware/context.js';
import { applyErrorMiddleware } from './middleware/error.js';
import { createLogger } from './lib/logger.js';
import { errorResponse, success } from './lib/response.js';

const API_UNAVAILABLE_MESSAGE =
  'Backend services are not initialized; API routes are unavailable.';

export function buildApp({ services = {} } = {}) {
  const logger = createLogger({ component: 'app' });
  const app = express();

  if (config.server.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  applySecurityMiddleware(app);
  applyRequestMiddleware(app);
  applyContextMiddleware(app, services);

  const livenessHandler = (_req, res) =>
    success(res, { status: 'ok', api: 'unavailable' });
  app.get(['/health', '/health/live'], livenessHandler);
  app.get('/health/ready', (_req, res) =>
    errorResponse(res, {
      code: 'NOT_READY',
      message: API_UNAVAILABLE_MESSAGE,
      status: 503,
    })
  );

  app.use(config.server.apiPrefix, (_req, res) =>
    errorResponse(res, {
      code: 'API_UNAVAILABLE',
      message: API_UNAVAILABLE_MESSAGE,
      status: 503,
    })
  );

  applyErrorMiddleware(app, logger);

  return app;
}