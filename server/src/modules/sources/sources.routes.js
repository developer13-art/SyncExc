/**
 * SyncExc Server — Sources routes
 */

import { Router } from 'express';
import Joi from 'joi';
import {
  RegisterSourceRequestSchema,
  CreateDiscoveryJobRequestSchema,
  SubmitReviewDecisionRequestSchema,
  UuidSchema,
} from '@syncexc/shared';
import { createSourcesController } from './sources.controller.js';

const AuthorizeConnectionSchema = Joi.object({
  credentials: Joi.object().unknown(true).required(),
});

const SandboxSchema = Joi.object({
  sampleSize: Joi.number().integer().min(1).max(100).default(10),
});

export function createSourcesRoutes(services) {
  const controller = createSourcesController(services);
  const { middleware } = services;
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Sources
   * ------------------------------------------------------------------------ */
  router.get(
    '/',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.list)
  );

  router.post(
    '/',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(RegisterSourceRequestSchema),
    middleware.asyncHandler(controller.create)
  );

  router.get(
    '/:sourceId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateParams(Joi.object({ sourceId: UuidSchema.required() })),
    middleware.asyncHandler(controller.get)
  );

  router.patch(
    '/:sourceId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.update)
  );

  router.post(
    '/:sourceId/activate',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.activate)
  );

  router.post(
    '/:sourceId/pause',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.pause)
  );

  router.post(
    '/:sourceId/archive',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.archive)
  );

  /* ---------------------------------------------------------------------------
   * Connection
   * ------------------------------------------------------------------------ */
  router.post(
    '/:sourceId/connection/authorize',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(AuthorizeConnectionSchema),
    middleware.asyncHandler(controller.authorizeConnection)
  );

  router.post(
    '/:sourceId/connection/test',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.testConnection)
  );

  router.delete(
    '/:sourceId/connection',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.disconnectConnection)
  );

  /* ---------------------------------------------------------------------------
   * Validation, health, quality, sandbox
   * ------------------------------------------------------------------------ */
  router.post(
    '/:sourceId/validate',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.runValidation)
  );

  router.get(
    '/:sourceId/validations',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listValidations)
  );

  router.get(
    '/:sourceId/health',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getHealth)
  );

  router.post(
    '/:sourceId/health/check',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.checkHealth)
  );

  router.get(
    '/:sourceId/quality',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getQuality)
  );

  router.post(
    '/:sourceId/sandbox',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(SandboxSchema),
    middleware.asyncHandler(controller.runSandbox)
  );

  /* ---------------------------------------------------------------------------
   * Discovery
   * ------------------------------------------------------------------------ */
  router.post(
    '/discovery/jobs',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CreateDiscoveryJobRequestSchema),
    middleware.asyncHandler(controller.createDiscoveryJob)
  );

  router.get(
    '/discovery/jobs',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listDiscoveryJobs)
  );

  router.get(
    '/discovery/jobs/:jobId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getDiscoveryJob)
  );

  router.get(
    '/discovery/candidates',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listCandidates)
  );

  router.get(
    '/discovery/candidates/:candidateId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getCandidate)
  );

  /* ---------------------------------------------------------------------------
   * Reviews
   * ------------------------------------------------------------------------ */
  router.post(
    '/reviews',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(SubmitReviewDecisionRequestSchema),
    middleware.asyncHandler(controller.submitReview)
  );

  return router;
}

export default createSourcesRoutes;