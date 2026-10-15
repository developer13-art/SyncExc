/**
 * SyncExc Server — Synchronization routes
 */

import { Router } from 'express';
import Joi from 'joi';
import {
  CreateSyncGroupRequestSchema,
  AddDestinationRequestSchema,
  PauseSyncGroupRequestSchema,
  PaginationSchema,
  UuidSchema,
} from '@syncexc/shared';
import { createSyncController } from './synchronization.controller.js';

export function createSyncRoutes({ service, orchestrator, reconciliation, middleware }) {
  const controller = createSyncController({ service, reconciliation });
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Groups
   * ------------------------------------------------------------------------ */
  router.get(
    '/groups',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('sync.view'),
    middleware.asyncHandler(controller.listGroups)
  );

  router.post(
    '/groups',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('sync.configure'),
    middleware.validateBody(CreateSyncGroupRequestSchema),
    middleware.asyncHandler(controller.createGroup)
  );

  router.get(
    '/groups/:groupId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('sync.view'),
    middleware.asyncHandler(controller.getGroup)
  );

  router.post(
    '/groups/:groupId/destinations',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('sync.configure'),
    middleware.validateBody(AddDestinationRequestSchema),
    middleware.asyncHandler(controller.addDestination)
  );

  router.post(
    '/groups/:groupId/pause',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('sync.pause'),
    middleware.validateBody(PauseSyncGroupRequestSchema),
    middleware.asyncHandler(controller.pauseGroup)
  );

  router.post(
    '/groups/:groupId/resume',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('sync.resume'),
    middleware.asyncHandler(controller.resumeGroup)
  );

  /* ---------------------------------------------------------------------------
   * Operations
   * ------------------------------------------------------------------------ */
  router.get(
    '/operations',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('sync.view'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listOperations)
  );

  router.get(
    '/operations/:operationId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('sync.view'),
    middleware.asyncHandler(controller.getOperation)
  );

  router.post(
    '/operations/:operationId/reconcile',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('sync.configure'),
    middleware.asyncHandler(controller.reconcileOperation)
  );

  /* ---------------------------------------------------------------------------
   * Statistics
   * ------------------------------------------------------------------------ */
  router.get(
    '/stats',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('sync.view'),
    middleware.asyncHandler(controller.getStats)
  );

  return router;
}

export default createSyncRoutes;