/**
 * SyncExc Server — Risk controller
 */

import { success, created, paginated } from '../../lib/response.js';
import { serializeRiskPolicy, serializeRiskEvaluation, serializeIncident, serializeAuditEvent } from '../../lib/serializers.js';

export function createRiskController({
  policyService,
  evaluationService,
  exposureService,
  approvalService,
  emergencyPauseService,
  circuitBreakerService,
  incidentService,
  alertService,
}) {
  return {
    /* Policies */
    async listPolicies(req, res) {
      const policies = await policyService.listPolicies({
        workspaceId: req.workspace.id,
        status: req.query.status,
      });
      return success(res, policies.map(serializeRiskPolicy));
    },

    async createPolicy(req, res) {
      const policy = await policyService.createPolicy({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        name: req.body.name,
        scope: req.body.scope,
        scopeRef: req.body.scopeRef,
        enforcementMode: req.body.enforcementMode,
        rules: req.body.rules,
      });
      return created(res, serializeRiskPolicy(policy));
    },

    async getPolicy(req, res) {
      const result = await policyService.getPolicy({
        policyId: req.params.policyId,
        workspaceId: req.workspace.id,
      });
      return success(res, { policy: serializeRiskPolicy(result.policy), rules: result.rules });
    },

    async suspendPolicy(req, res) {
      const policy = await policyService.suspendPolicy({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        policyId: req.params.policyId,
      });
      return success(res, serializeRiskPolicy(policy));
    },

    /* Evaluation */
    async evaluate(req, res) {
      const evaluation = await evaluationService.evaluate({
        workspaceId: req.workspace.id,
        operationType: req.body.operationType,
        operationPayload: req.body,
      });
      return success(res, serializeRiskEvaluation(evaluation));
    },

    async listEvaluations(req, res) {
      const { rows, nextCursor } = await evaluationService.listEvaluations({
        workspaceId: req.workspace.id,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeRiskEvaluation), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    /* Exposure */
    async getExposure(req, res) {
      const exposure = await exposureService.getWorkspaceExposure(req.workspace.id);
      return success(res, exposure);
    },

    async getAccountExposure(req, res) {
      const exposure = await exposureService.getAccountExposure({
        workspaceId: req.workspace.id,
        accountId: req.params.accountId,
      });
      return success(res, exposure);
    },

    /* Approvals */
    async listPendingApprovals(req, res) {
      const approvals = await approvalService.listPending({ workspaceId: req.workspace.id });
      return success(res, approvals);
    },

    async decideApproval(req, res) {
      const result = await approvalService.decide({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        approvalId: req.params.approvalId,
        decision: req.body.decision,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    /* Emergency pause */
    async requestEmergencyPause(req, res) {
      const result = await emergencyPauseService.request({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        scope: req.body.scope,
        scopeRef: req.body.scopeRef,
        reason: req.body.reason,
      });
      return created(res, result);
    },

    async resumeEmergencyPause(req, res) {
      const result = await emergencyPauseService.resume({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        pauseId: req.params.pauseId,
      });
      return success(res, result);
    },

    async getActivePauses(req, res) {
      const pauses = await emergencyPauseService.getActive({ workspaceId: req.workspace.id });
      return success(res, pauses);
    },

    /* Circuit breakers */
    async listCircuitBreakers(req, res) {
      const breakers = await circuitBreakerService.listActive({ workspaceId: req.workspace.id });
      return success(res, breakers);
    },

    async resetCircuitBreaker(req, res) {
      const result = await circuitBreakerService.reset({
        breakerId: req.params.breakerId,
        userId: req.auth.userId,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    /* Incidents */
    async listIncidents(req, res) {
      const { rows, nextCursor } = await incidentService.list({
        workspaceId: req.workspace.id,
        status: req.query.status,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeIncident), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async getIncident(req, res) {
      const result = await incidentService.get({
        incidentId: req.params.incidentId,
        workspaceId: req.workspace.id,
      });
      return success(res, result);
    },

    async resolveIncident(req, res) {
      const result = await incidentService.resolve({
        incidentId: req.params.incidentId,
        workspaceId: req.workspace.id,
        userId: req.auth.userId,
        rootCause: req.body.rootCause,
        prevention: req.body.prevention,
      });
      return success(res, result);
    },

    /* Alerts */
    async listAlerts(req, res) {
      const alerts = await alertService.list({
        workspaceId: req.workspace.id,
        state: req.query.state,
        limit: Number(req.query.limit) || 50,
      });
      return success(res, alerts);
    },

    async acknowledgeAlert(req, res) {
      const alert = await alertService.acknowledge({
        alertId: req.params.alertId,
        workspaceId: req.workspace.id,
        userId: req.auth.userId,
      });
      return success(res, alert);
    },

    async resolveAlert(req, res) {
      const alert = await alertService.resolve({
        alertId: req.params.alertId,
      });
      return success(res, alert);
    },
  };
}

export default createRiskController;