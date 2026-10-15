/**
 * SyncExc Server — Incidents routes
 */

import { Router } from 'express';
import Joi from 'joi';
import { UuidSchema, PaginationSchema } from '@syncexc/shared';
import { createIncidentsController } from './incidents.controller.js';

const CreateIncidentSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  severity: Joi.string().valid('sev1', 'sev2', 'sev3', 'sev4').required(),
  summary: Joi.string().min(10).max(2000).required(),
  affectedServices: Joi.array().items(Joi.string().max(64)).optional(),
  affectedFeatures: Joi.array().items(Joi.string().max(64)).optional(),
  incidentOwnerId: UuidSchema.optional(),
  customerFacingStatus: Joi.object({
    title: Joi.string().max(200).optional(),
    summary: Joi.string().max(2000).optional(),
    status: Joi.string().max(32).optional(),
  }).optional(),
});

const UpdateIncidentSchema = Joi.object({
  title: Joi.string().min(5).max(200).optional(),
  severity: Joi.string().valid('sev1', 'sev2', 'sev3', 'sev4').optional(),
  status: Joi.string().valid('investigating', 'identified', 'monitoring', 'resolved').optional(),
  summary: Joi.string().min(10).max(2000).optional(),
  affectedServices: Joi.array().items(Joi.string().max(64)).optional(),
  affectedFeatures: Joi.array().items(Joi.string().max(64)).optional(),
  incidentOwnerId: UuidSchema.optional().allow(null),
  customerFacingStatus: Joi.object().unknown(true).optional(),
  reason: Joi.string().max(500).optional(),
}).min(1);

const ResolveSchema = Joi.object({
  summary: Joi.string().min(10).max(2000).optional(),
  postMortemRef: Joi.string().max(500).optional(),
});

const EventSchema = Joi.object({
  eventType: Joi.string().max(64).required(),
  message: Joi.string().max(2000).optional(),
  metadata: Joi.object().unknown(true).optional(),
});

const CommentSchema = Joi.object({
  content: Joi.string().min(1).max(10000).required(),
  isInternal: Joi.boolean().default(true),
});

const LinkSchema = Joi.object({
  ticketId: UuidSchema.required(),
});

const AffectedWorkspaceSchema = Joi.object({
  workspaceId: UuidSchema.required(),
});

export function createIncidentRoutes({ incidentService, middleware }) {
  const controller = createIncidentsController({ incidentService });
  const router = Router();

  // Public status page: list active incidents
  router.get(
    '/',
    middleware.optionalAuth(),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.list)
  );

  router.get(
    '/:incidentId',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.get)
  );

  router.get(
    '/:incidentId/events',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.listEvents)
  );

  router.get(
    '/:incidentId/comments',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.listComments)
  );

  // Staff-only operations
  router.post(
    '/',
    middleware.requireAuth(),
    middleware.requireAdmin(),
    middleware.validateBody(CreateIncidentSchema),
    middleware.asyncHandler(controller.create)
  );

  router.patch(
    '/:incidentId',
    middleware.requireAuth(),
    middleware.requireAdmin(),
    middleware.validateBody(UpdateIncidentSchema),
    middleware.asyncHandler(controller.update)
  );

  router.post(
    '/:incidentId/resolve',
    middleware.requireAuth(),
    middleware.requireAdmin(),
    middleware.validateBody(ResolveSchema),
    middleware.asyncHandler(controller.resolve)
  );

  router.post(
    '/:incidentId/events',
    middleware.requireAuth(),
    middleware.requireAdmin(),
    middleware.validateBody(EventSchema),
    middleware.asyncHandler(controller.addEvent)
  );

  router.post(
    '/:incidentId/comments',
    middleware.requireAuth(),
    middleware.requireAdmin(),
    middleware.validateBody(CommentSchema),
    middleware.asyncHandler(controller.addComment)
  );

  router.post(
    '/:incidentId/tickets',
    middleware.requireAuth(),
    middleware.requireAdmin(),
    middleware.validateBody(LinkSchema),
    middleware.asyncHandler(controller.linkTicket)
  );

  router.post(
    '/:incidentId/affected-workspaces',
    middleware.requireAuth(),
    middleware.requireAdmin(),
    middleware.validateBody(AffectedWorkspaceSchema),
    middleware.asyncHandler(controller.linkAffectedWorkspace)
  );

  return router;
}

export default createIncidentRoutes;