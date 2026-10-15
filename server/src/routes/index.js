/**
 * SyncExc Server — Root route mounting
 *
 * Mounts every module's routes under /api/v1/<module>. Public API for
 * external developers is mounted under /api/public/v1.
 */

import { Router } from 'express';
import { success } from '../lib/response.js';

export function mountRoutes({ services }) {
  const router = Router();

  // Health endpoints are public
  router.get('/health', (_req, res) => {
    return success(res, { status: 'ok', time: new Date().toISOString() });
  });

  router.get('/health/ready', (_req, res, next) => {
    services.db
      .health()
      .then((dbHealth) => {
        const status = dbHealth.ok ? 200 : 503;
        res.status(status).json({
          data: {
            status: dbHealth.ok ? 'ready' : 'not_ready',
            database: dbHealth,
          },
          meta: { timestamp: new Date().toISOString() },
        });
      })
      .catch(next);
  });

  router.get('/health/live', (_req, res) => {
    return success(res, { status: 'alive' });
  });

  // Metrics (Prometheus format) — protected by prefix check in prod
  if (services.metrics && services.config.observability.metricsEnabled) {
    router.get(services.config.observability.metricsPath, (_req, res, next) => {
      services.metrics
        .metrics()
        .then((body) => {
          res.setHeader('Content-Type', services.metrics.contentType);
          res.end(body);
        })
        .catch(next);
    });
  }

  // Module routes
  const modules = services.modules || {};

  // Auth + users (identity)
  if (modules.identity) {
    const routes = modules.identity.routes;
    router.use('/auth', routes.auth);
    router.use('/users', routes.users);
  }

  // Workspaces
  if (modules.workspaces) {
    router.use('/workspaces', modules.workspaces.routes);
  }

  // Billing
  if (modules.billing) {
    router.use('/billing', modules.billing.routes);
  }

  // Connections
  if (modules.connections) {
    router.use('/connections', modules.connections.routes);
  }

  // Terminal
  if (modules.terminal) {
    router.use('/terminal', modules.terminal.routes);
  }

  // Synchronization
  if (modules.synchronization) {
    router.use('/sync', modules.synchronization.routes);
  }

  // Risk
  if (modules.risk) {
    router.use('/risk', modules.risk.routes);
  }

  // Sources
  if (modules.sources) {
    router.use('/sources', modules.sources.routes);
  }

  // Signals
  if (modules.signals) {
    router.use('/signals', modules.signals.routes);
  }

  // Marketplace
  if (modules.marketplace) {
    router.use('/marketplace', modules.marketplace.routes);
  }

  // Automation
  if (modules.automation) {
    router.use('/automation', modules.automation.routes);
  }

  // Simulation
  if (modules.simulation) {
    router.use('/simulation', modules.simulation.routes);
  }

  // Referral
  if (modules.referral) {
    router.use('/referral', modules.referral.routes);
  }

  // Developer (management endpoints)
  if (modules.developer) {
    router.use('/developer', modules.developer.routes.admin);
  }

  // Community
  if (modules.community) {
    router.use('/community', modules.community.routes);
  }

  // Notifications
  if (modules.notifications) {
    router.use('/notifications', modules.notifications.routes);
  }

  // Support
  if (modules.support) {
    router.use('/support', modules.support.routes);
  }

  // Admin
  if (modules.admin) {
    router.use('/admin', modules.admin.routes);
  }

  // Platform incidents
  if (modules.incidents) {
    router.use('/incidents', modules.incidents.routes);
  }

  // Public developer API (external consumption)
  if (modules.developer && modules.developer.routes.public) {
    router.use('/public/v1', modules.developer.routes.public);
  }

  return router;
}

export default mountRoutes;