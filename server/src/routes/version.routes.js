/**
 * SyncExc Server — Version endpoint
 */

import { Router } from 'express';
import { success } from '../lib/response.js';

export function createVersionRoutes() {
  const router = Router();

  router.get('/', (_req, res) => {
    return success(res, {
      name: 'SyncExc API',
      version: process.env.npm_package_version || '1.0.0',
      apiVersion: 'v1',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  return router;
}

export default createVersionRoutes;