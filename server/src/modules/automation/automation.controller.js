/**
 * SyncExc Server — Automation controller
 */

import { success, created, paginated } from '../../lib/response.js';
import { serializeWorkflow, serializeWorkflowRun } from '../../lib/serializers.js';

export function createAutomationController(services) {
  const {
    workflowService,
    versionService,
    triggerService,
    scheduleService,
    validationService,
    testRunService,
    executionEngine,
    nodeRegistry,
    pauseService,
    queries,
  } = services;

  return {
    /* Node catalog */
    async nodeCatalog(req, res) {
      return success(res, nodeRegistry.list());
    },

    /* Workflows */
    async listWorkflows(req, res) {
      const workflows = await workflowService.listWorkflows({
        workspaceId: req.workspace.id,
        status: req.query.status,
      });
      return success(res, workflows.map(serializeWorkflow));
    },

    async createWorkflow(req, res) {
      const workflow = await workflowService.createWorkflow({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        name: req.body.name,
        description: req.body.description,
      });
      return created(res, serializeWorkflow(workflow));
    },

    async getWorkflow(req, res) {
      const workflow = await workflowService.getWorkflow({
        workflowId: req.params.workflowId,
        workspaceId: req.workspace.id,
      });
      return success(res, serializeWorkflow(workflow));
    },

    async updateWorkflow(req, res) {
      const workflow = await workflowService.updateWorkflow({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
        updates: req.body,
      });
      return success(res, serializeWorkflow(workflow));
    },

    async deleteWorkflow(req, res) {
      const workflow = await workflowService.deleteWorkflow({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
      });
      return success(res, serializeWorkflow(workflow));
    },

    /* Versions */
    async listVersions(req, res) {
      const versions = await versionService.listVersions({
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
      });
      return success(res, versions);
    },

    async createDraftVersion(req, res) {
      const version = await versionService.createDraftVersion({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
        definition: req.body.definition,
      });
      return created(res, version);
    },

    async validateWorkflow(req, res) {
      const result = await validationService.validateDefinition({
        definition: req.body.definition,
        workspaceId: req.workspace.id,
      });
      return success(res, result);
    },

    async publishVersion(req, res) {
      const version = await versionService.publishVersion({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
        versionId: req.body.versionId,
      });
      return success(res, version);
    },

    /* Triggers */
    async listTriggers(req, res) {
      const triggers = await triggerService.listTriggers({
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
      });
      return success(res, triggers);
    },

    async registerTriggers(req, res) {
      const triggers = await triggerService.registerTriggers({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
        versionId: req.body.versionId,
        triggers: req.body.triggers,
      });
      return created(res, triggers);
    },

    /* Schedules */
    async listSchedules(req, res) {
      const schedules = await scheduleService.listSchedules({
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
      });
      return success(res, schedules);
    },

    async registerSchedules(req, res) {
      const schedules = await scheduleService.registerSchedules({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
        versionId: req.body.versionId,
        schedules: req.body.schedules,
      });
      return created(res, schedules);
    },

    async pauseSchedule(req, res) {
      const result = await scheduleService.pauseSchedule({
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
        scheduleId: req.params.scheduleId,
      });
      return success(res, result);
    },

    async resumeSchedule(req, res) {
      const result = await scheduleService.resumeSchedule({
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
        scheduleId: req.params.scheduleId,
      });
      return success(res, result);
    },

    /* Runs */
    async listRuns(req, res) {
      const { rows, nextCursor } = await queries.listRunsForWorkflow(req.params.workflowId, {
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
        state: req.query.state || null,
      });
      return paginated(res, rows.map(serializeWorkflowRun), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async getRun(req, res) {
      const run = await queries.findRunById(req.params.runId);
      if (!run) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Run not found' } });
      const steps = await queries.listRunSteps(req.params.runId);
      return success(res, { run: serializeWorkflowRun(run, steps), steps });
    },

    async createRun(req, res) {
      const run = await executionEngine.createRun({
        workflowId: req.params.workflowId,
        versionId: req.body.versionId,
        input: req.body.input || {},
        triggerEventId: req.body.triggerEventId || null,
        correlationId: req.correlation.id,
      });
      return created(res, serializeWorkflowRun(run));
    },

    /* Pause / resume */
    async pauseWorkflow(req, res) {
      const result = await pauseService.pauseWorkflow({
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
        reason: req.body.reason,
      });
      return success(res, serializeWorkflow(result));
    },

    async resumeWorkflow(req, res) {
      const result = await pauseService.resumeWorkflow({
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
      });
      return success(res, serializeWorkflow(result));
    },

    /* Test runs */
    async runTest(req, res) {
      const result = await testRunService.runTest({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
        sampleInput: req.body.sampleInput || {},
      });
      return success(res, result);
    },

    async listTestRuns(req, res) {
      const results = await testRunService.listTestRuns({
        workspaceId: req.workspace.id,
        workflowId: req.params.workflowId,
        limit: Number(req.query.limit) || 50,
      });
      return success(res, results);
    },
  };
}

export default createAutomationController;