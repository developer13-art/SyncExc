import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const automationApi = {
  listWorkflows: (params) => api.getPaged(endpoints.automation.workflows, { params }),

  createWorkflow: (payload) => api.post(endpoints.automation.workflows, payload),

  getWorkflow: (workflowId) => api.get(endpoints.automation.workflow(workflowId)),

  updateWorkflow: (workflowId, payload) =>
    api.patch(endpoints.automation.workflow(workflowId), payload),

  listVersions: (workflowId) => api.get(endpoints.automation.workflowVersions(workflowId)),

  validateWorkflow: (workflowId, payload) =>
    api.post(endpoints.automation.validateWorkflow(workflowId), payload),

  publishWorkflow: (workflowId, payload) =>
    api.post(endpoints.automation.publishWorkflow(workflowId), payload),

  activateWorkflow: (workflowId, payload) =>
    api.post(endpoints.automation.activateWorkflow(workflowId), payload),

  rollbackWorkflow: (workflowId, payload) =>
    api.post(endpoints.automation.rollbackWorkflow(workflowId), payload),

  retireWorkflow: (workflowId, payload) =>
    api.post(endpoints.automation.retireWorkflow(workflowId), payload),

  pauseWorkflow: (workflowId, payload) =>
    api.post(endpoints.automation.pauseWorkflow(workflowId), payload),

  resumeWorkflow: (workflowId, payload) =>
    api.post(endpoints.automation.resumeWorkflow(workflowId), payload),

  listTriggers: (workflowId) => api.get(endpoints.automation.workflowTriggers(workflowId)),

  createTrigger: (workflowId, payload) =>
    api.post(endpoints.automation.workflowTriggers(workflowId), payload),

  updateTrigger: (triggerId, payload) =>
    api.patch(endpoints.automation.trigger(triggerId), payload),

  pauseTrigger: (triggerId, payload) =>
    api.post(endpoints.automation.pauseTrigger(triggerId), payload),

  listSchedules: (workflowId) =>
    api.get(endpoints.automation.workflowSchedules(workflowId)),

  createSchedule: (workflowId, payload) =>
    api.post(endpoints.automation.workflowSchedules(workflowId), payload),

  updateSchedule: (scheduleId, payload) =>
    api.patch(endpoints.automation.schedule(scheduleId), payload),

  pauseSchedule: (scheduleId) => api.post(endpoints.automation.pauseSchedule(scheduleId)),

  resumeSchedule: (scheduleId) => api.post(endpoints.automation.resumeSchedule(scheduleId)),

  listTestRuns: (workflowId, params) =>
    api.getPaged(endpoints.automation.testRuns(workflowId), { params }),

  createTestRun: (workflowId, payload) =>
    api.post(endpoints.automation.testRuns(workflowId), payload),

  getTestRun: (testRunId) => api.get(endpoints.automation.testRun(testRunId)),

  triggerManualRun: (workflowId, payload) =>
    api.post(endpoints.automation.manualRun(workflowId), payload),

  listRuns: (params) => api.getPaged(endpoints.automation.runs, { params }),

  getRun: (runId) => api.get(endpoints.automation.run(runId)),

  getRunSteps: (runId) => api.get(endpoints.automation.runSteps(runId)),

  cancelRun: (runId, payload) => api.post(endpoints.automation.cancelRun(runId), payload),

  getMetrics: (workflowId, params) =>
    api.get(endpoints.automation.workflowMetrics(workflowId), { params }),

  getAudit: (workflowId, params) =>
    api.getPaged(endpoints.automation.workflowAudit(workflowId), { params }),

  listTemplates: (params) => api.getPaged(endpoints.automation.templates, { params }),

  getTemplate: (templateId) => api.get(endpoints.automation.template(templateId)),

  cloneTemplate: (templateId, payload) =>
    api.post(endpoints.automation.cloneTemplate(templateId), payload),

  getUsage: () => api.get(endpoints.automation.usage),
};