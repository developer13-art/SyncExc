/**
 * SyncExc Server — Automation routes
 */

import { Router } from 'express';
import Joi from 'joi';
import { UuidSchema, PaginationSchema } from '@syncexc/shared';
import { createAutomationController } from './automation.controller.js';

const CreateWorkflowSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(2000).optional().allow(''),
});

const UpdateWorkflowSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().trim().max(2000).optional().allow(''),
}).min(1);

const DefinitionSchema = Joi.object({
  nodes: Joi.array().items(Joi.object().unknown(true)).required(),
  edges: Joi.array().items(Joi.object().unknown(true)).required(),
  input: Joi.object().unknown(true).optional(),
});

const PublishSchema = Joi.object({
  versionId: UuidSchema.required(),
});

const TriggersSchema = Joi.object({
  versionId: UuidSchema.required(),
  triggers: Joi.array().items(
    Joi.object({
      type: Joi.string().required(),
      config: Joi.object().unknown(true).optional(),
    })
  ).min(1).required(),
});

const SchedulesSchema = Joi.object({
  versionId: UuidSchema.required(),
  schedules: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('one_time', 'recurring', 'daily', 'weekly', 'calendar').default('recurring'),
      expression: Joi.string().required(),
      timezone: Joi.string().max(64).default('UTC'),
    })
  ).min(1).required(),
});

const PauseSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required(),
});

export function createAutomationRoutes(services) {
  const controller = createAutomationController(services);
  const { middleware } = services;
  const router = Router();

  /* Node catalog (public-ish for authenticated users) */
  router.get(
    '/node-catalog',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.nodeCatalog)
  );

  /* Workflows */
  router.get(
    '/workflows',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listWorkflows)
  );

  router.post(
    '/workflows',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CreateWorkflowSchema),
    middleware.asyncHandler(controller.createWorkflow)
  );

  router.get(
    '/workflows/:workflowId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getWorkflow)
  );

  router.patch(
    '/workflows/:workflowId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(UpdateWorkflowSchema),
    middleware.asyncHandler(controller.updateWorkflow)
  );

  router.delete(
    '/workflows/:workflowId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.deleteWorkflow)
  );

  /* Versions */
  router.get(
    '/workflows/:workflowId/versions',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listVersions)
  );

  router.post(
    '/workflows/:workflowId/versions',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(DefinitionSchema),
    middleware.asyncHandler((req, res) => {
      req.body = { definition: req.body };
      return controller.createDraftVersion(req, res);
    })
  );

  router.post(
    '/workflows/:workflowId/validate',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(DefinitionSchema),
    middleware.asyncHandler(controller.validateWorkflow)
  );

  router.post(
    '/workflows/:workflowId/publish',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(PublishSchema),
    middleware.asyncHandler(controller.publishVersion)
  );

  /* Triggers */
  router.get(
    '/workflows/:workflowId/triggers',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listTriggers)
  );

  router.post(
    '/workflows/:workflowId/triggers',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(TriggersSchema),
    middleware.asyncHandler(controller.registerTriggers)
  );

  /* Schedules */
  router.get(
    '/workflows/:workflowId/schedules',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listSchedules)
  );

  router.post(
    '/workflows/:workflowId/schedules',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(SchedulesSchema),
    middleware.asyncHandler(controller.registerSchedules)
  );

  router.post(
    '/workflows/:workflowId/schedules/:scheduleId/pause',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.pauseSchedule)
  );

  router.post(
    '/workflows/:workflowId/schedules/:scheduleId/resume',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.resumeSchedule)
  );

  /* Runs */
  router.get(
    '/workflows/:workflowId/runs',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listRuns)
  );

  router.post(
    '/workflows/:workflowId/runs',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.createRun)
  );

  router.get(
    '/runs/:runId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getRun)
  );

  /* Pause / resume */
  router.post(
    '/workflows/:workflowId/pause',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(PauseSchema),
    middleware.asyncHandler(controller.pauseWorkflow)
  );

  router.post(
    '/workflows/:workflowId/resume',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.resumeWorkflow)
  );

  /* Test runs */
  router.post(
    '/workflows/:workflowId/test-runs',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.runTest)
  );

  router.get(
    '/workflows/:workflowId/test-runs',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listTestRuns)
  );

  return router;
}

export default createAutomationRoutes;