/**
 * SyncExc Server — Standalone health routes (used by infrastructure probes)
 */

import { Router } from 'express';

export function createHealthRoutes({ services }) {
  const router = Router();

  router.get('/healthz', async (_req, res) => {
    try {
      const db = await services.db.health();
      if (!db.ok) return res.status(503).json({ status: 'unhealthy', database: db });
      return res.json({ status: 'healthy', database: { latencyMs: db.latencyMs } });
    } catch (err) {
      return res.status(503).json({ status: 'unhealthy', error: err.message });
    }
  });

  router.get('/readyz', async (_req, res) => {
    try {
      const db = await services.db.health();
      if (!db.ok) return res.status(503).json({ status: 'not_ready' });
      return res.json({ status: 'ready' });
    } catch (err) {
      return res.status(503).json({ status: 'not_ready', error: err.message });
    }
  });

  return router;
}

export default createHealthRoutes;