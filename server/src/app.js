/**
 * SyncExc Server — Express application factory
 *
 * Builds the Express application with:
 *   - security middleware (helmet, cors, compression)
 *   - request middleware (id, logger, parser, cookies)
 *   - request context (correlation ID)
 *   - liveness and readiness endpoints
 *   - the mounted versioned API and domain routes
 *   - 404 and error handlers
 */

import express from 'express';
import config from './config.js';
import { applySecurityMiddleware } from './middleware/security.js';
import { applyRequestMiddleware } from './middleware/request.js';
import { applyContextMiddleware } from './middleware/context.js';
import { applyErrorMiddleware } from './middleware/error.js';
import { createLogger } from './lib/logger.js';
import { success } from './lib/response.js';
import { mountRoutes } from './routes/index.js';

export function buildApp({ services = {} } = {}) {
  const logger = createLogger({ component: 'app' });
  const app = express();

  if (config.server.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  applySecurityMiddleware(app);
  applyRequestMiddleware(app);
  applyContextMiddleware(app, services);

  app.get(['/health', '/health/live'], (_req, res) =>
    success(res, { status: 'ok' })
  );
  app.get('/health/ready', (_req, res, next) => {
    if (typeof services.db?.health !== 'function') {
      return res.status(503).json({
        error: { code: 'NOT_READY', message: 'Database is not initialized' },
      });
    }

    services.db
      .health()
      .then((health) =>
        res.status(health.ok ? 200 : 503).json({
          data: { status: health.ok ? 'ready' : 'not_ready', database: health },
          meta: { timestamp: new Date().toISOString() },
        }),
      )
      .catch(next);
  });

  app.use(config.server.apiPrefix, mountRoutes({ services }));

  applyErrorMiddleware(app, logger);

  return app;
}