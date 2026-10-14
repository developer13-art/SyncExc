/**
 * SyncExc Server — Express application factory
 *
 * Builds the Express app with:
 *   - security middleware (helmet, cors, compression)
 *   - request middleware (id, logger, parser, cookies)
 *   - request context (correlation ID)
 *   - API routes (mounted under /api/v1)
 *   - health and metrics endpoints
 *   - 404 and error handlers
 */

import express from 'express';
import config from './config.js';
import { applySecurityMiddleware } from './middleware/security.js';
import { applyRequestMiddleware } from './middleware/request.js';
import { applyContextMiddleware } from './middleware/context.js';
import { applyRateLimitMiddleware } from './middleware/rate-limit.js';
import { applyErrorMiddleware } from './middleware/error.js';
import { mountRoutes } from './routes/index.js';
import { createLogger } from './lib/logger.js';

export function buildApp({ services }) {
  const logger = createLogger({ component: 'app' });
  const app = express();

  if (config.server.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  applySecurityMiddleware(app);
  applyRequestMiddleware(app);
  applyContextMiddleware(app, services);
  applyRateLimitMiddleware(app, services);

  app.use(config.server.apiPrefix, mountRoutes({ services }));

  applyErrorMiddleware(app, logger);

  return app;
}