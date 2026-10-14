/**
 * SyncExc Server — Risk routes
 */

import { Router } from 'express';
import Joi from 'joi';
import {
  CreateRiskPolicyRequestSchema,
  EvaluateOperationRequestSchema,
  RequestEmergencyPauseRequestSchema,
  ApproveOperationRequestSchema,
  PaginationSchema,
  UuidSchema,
} from '@syncexc/shared';
import { createRiskController } from './risk.controller.js';

const ResetBreakerSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required(),
});

const ResolveIncidentSchema = Joi.object({
  rootCause: Joi.string().min(10).max(2000).required(),
  prevention: Joi.string().max(2000).optional(),
});

export function createRiskRoutes(services) {
  const controller = createRiskController(services);
  const { middleware } = services;
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Policies
   * ------------------------------------------------------------------------ */
  router.get(
    '/policies',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.view'),
    middleware.asyncHandler(controller.listPolicies)
  );

  router.post(
    '/policies',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.configure'),
    middleware.validateBody(CreateRiskPolicyRequestSchema),
    middleware.asyncHandler(controller.createPolicy)
  );

  router.get(
    '/policies/:policyId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.view'),
    middleware.asyncHandler(controller.getPolicy)
  );

  router.post(
    '/policies/:policyId/suspend',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.configure'),
    middleware.asyncHandler(controller.suspendPolicy)
  );

  /* ---------------------------------------------------------------------------
   * Evaluation
   * ------------------------------------------------------------------------ */
  router.post(
    '/evaluate',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(EvaluateOperationRequestSchema),
    middleware.asyncHandler(controller.evaluate)
  );

  router.get(
    '/evaluations',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.view'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listEvaluations)
  );

  /* ---------------------------------------------------------------------------
   * Exposure
   * ------------------------------------------------------------------------ */
  router.get(
    '/exposure',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.view'),
    middleware.asyncHandler(controller.getExposure)
  );

  router.get(
    '/exposure/accounts/:accountId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.view'),
    middleware.asyncHandler(controller.getAccountExposure)
  );

  /* ---------------------------------------------------------------------------
   * Approvals
   * ------------------------------------------------------------------------ */
  router.get(
    '/approvals',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.view'),
    middleware.asyncHandler(controller.listPendingApprovals)
  );

  router.post(
    '/approvals/:approvalId/decide',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.approve_execution'),
    middleware.validateBody(ApproveOperationRequestSchema),
    middleware.asyncHandler(controller.decideApproval)
  );

  /* ---------------------------------------------------------------------------
   * Emergency pause
   * ------------------------------------------------------------------------ */
  router.post(
    '/emergency-pause',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.override'),
    middleware.requireStepUp(),
    middleware.validateBody(RequestEmergencyPauseRequestSchema),
    middleware.asyncHandler(controller.requestEmergencyPause)
  );

  router.post(
    '/emergency-pause/:pauseId/resume',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.override'),
    middleware.requireStepUp(),
    middleware.asyncHandler(controller.resumeEmergencyPause)
  );

  router.get(
    '/emergency-pause/active',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.view'),
    middleware.asyncHandler(controller.getActivePauses)
  );

  /* ---------------------------------------------------------------------------
   * Circuit breakers
   * ------------------------------------------------------------------------ */
  router.get(
    '/circuit-breakers',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.view'),
    middleware.asyncHandler(controller.listCircuitBreakers)
  );

  router.post(
    '/circuit-breakers/:breakerId/reset',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.override'),
    middleware.validateBody(ResetBreakerSchema),
    middleware.asyncHandler(controller.resetCircuitBreaker)
  );

  /* ---------------------------------------------------------------------------
   * Incidents
   * ------------------------------------------------------------------------ */
  router.get(
    '/incidents',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.view'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listIncidents)
  );

  router.get(
    '/incidents/:incidentId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.view'),
    middleware.asyncHandler(controller.getIncident)
  );

  router.post(
    '/incidents/:incidentId/resolve',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.configure'),
    middleware.validateBody(ResolveIncidentSchema),
    middleware.asyncHandler(controller.resolveIncident)
  );

  /* ---------------------------------------------------------------------------
   * Alerts
   * ------------------------------------------------------------------------ */
  router.get(
    '/alerts',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.view'),
    middleware.asyncHandler(controller.listAlerts)
  );

  router.post(
    '/alerts/:alertId/acknowledge',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.view'),
    middleware.asyncHandler(controller.acknowledgeAlert)
  );

  router.post(
    '/alerts/:alertId/resolve',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('risk.configure'),
    middleware.asyncHandler(controller.resolveAlert)
  );

  return router;
}

export default createRiskRoutes;