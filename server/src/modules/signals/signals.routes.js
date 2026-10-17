/**
 * SyncExc Server — Signals routes
 */

import { Router } from 'express';
import Joi from 'joi';
import {
  IngestMessageRequestSchema,
  SubmitSignalReviewRequestSchema,
  RequestExecutionIntentRequestSchema,
  PaginationSchema,
  UuidSchema,
} from '@syncexc/shared';
import { createSignalsController } from './signals.controller.js';

const CandidateListQuerySchema = PaginationSchema.keys({
  status: Joi.string()
    .valid(
      'received',
      'deduplicated',
      'processing',
      'review_required',
      'validating',
      'eligible',
      'blocked',
      'expired',
      'canceled',
      'rejected',
      'failed'
    )
    .optional(),
  q: Joi.string().trim().max(120).allow('').optional(),
});

export function createSignalsRoutes(services) {
  const controller = createSignalsController(services);
  const { middleware } = services;
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Messages
   * ------------------------------------------------------------------------ */
  router.post(
    '/messages/ingest',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(IngestMessageRequestSchema),
    middleware.asyncHandler(controller.ingestMessage)
  );

  router.get(
    '/messages',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listMessages)
  );

  router.get(
    '/messages/:messageId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getMessage)
  );

  /* ---------------------------------------------------------------------------
   * Candidates
   * ------------------------------------------------------------------------ */
  router.get(
    '/candidates',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateQuery(CandidateListQuerySchema),
    middleware.asyncHandler(controller.listCandidates)
  );

  router.get(
    '/candidates/:candidateId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getCandidate)
  );

  router.post(
    '/candidates/:candidateId/validate',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.validateCandidate)
  );

  router.post(
    '/candidates/:candidateId/eligibility',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.decideEligibility)
  );

  /* ---------------------------------------------------------------------------
   * Reviews
   * ------------------------------------------------------------------------ */
  router.post(
    '/reviews',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(SubmitSignalReviewRequestSchema.extend({
      candidateId: UuidSchema.required(),
    })),
    middleware.asyncHandler(controller.submitReview)
  );

  /* ---------------------------------------------------------------------------
   * Execution intents
   * ------------------------------------------------------------------------ */
  router.post(
    '/execution-intents',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(RequestExecutionIntentRequestSchema),
    middleware.asyncHandler(controller.createIntent)
  );

  router.get(
    '/execution-intents/:intentId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateParams(Joi.object({ intentId: UuidSchema.required() })),
    middleware.asyncHandler(controller.getIntent)
  );

  router.post(
    '/execution-intents/:intentId/cancel',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.cancelIntent)
  );

  return router;
}

export default createSignalsRoutes;