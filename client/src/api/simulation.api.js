import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const simulationApi = {
  listEnvironments: (params) =>
    api.getPaged(endpoints.simulation.environments, { params }),

  createEnvironment: (payload) => api.post(endpoints.simulation.environments, payload),

  getEnvironment: (environmentId) =>
    api.get(endpoints.simulation.environment(environmentId)),

  updateEnvironment: (environmentId, payload) =>
    api.patch(endpoints.simulation.environment(environmentId), payload),

  archiveEnvironment: (environmentId) =>
    api.delete(endpoints.simulation.environment(environmentId)),

  listEnvironmentVersions: (environmentId) =>
    api.get(endpoints.simulation.environmentVersions(environmentId)),

  listRuns: (params) => api.getPaged(endpoints.simulation.runs, { params }),

  startRun: (payload) => api.post(endpoints.simulation.runs, payload),

  getRun: (runId) => api.get(endpoints.simulation.run(runId)),

  cancelRun: (runId) => api.post(`${endpoints.simulation.run(runId)}/cancel`),

  getRunOrders: (runId, params) =>
    api.getPaged(endpoints.simulation.runOrders(runId), { params }),

  getRunFills: (runId, params) =>
    api.getPaged(endpoints.simulation.runFills(runId), { params }),

  getRunPositions: (runId, params) =>
    api.get(endpoints.simulation.runPositions(runId), { params }),

  getRunMetrics: (runId) => api.get(endpoints.simulation.runMetrics(runId)),

  getRunEvents: (runId, params) =>
    api.getPaged(endpoints.simulation.runEvents(runId), { params }),

  getRunReport: (runId) => api.get(endpoints.simulation.runReport(runId)),

  listReplays: (params) => api.getPaged(endpoints.simulation.replays, { params }),

  startReplay: (payload) => api.post(endpoints.simulation.replays, payload),

  getReplay: (replayId) => api.get(endpoints.simulation.replay(replayId)),

  seekReplay: (replayId, payload) =>
    api.post(endpoints.simulation.replaySeek(replayId), payload),

  stepReplay: (replayId) => api.post(endpoints.simulation.replayStep(replayId)),

  listComparisons: (params) =>
    api.getPaged(endpoints.simulation.comparisons, { params }),

  createComparison: (payload) => api.post(endpoints.simulation.comparisons, payload),

  getComparison: (comparisonId) =>
    api.get(endpoints.simulation.comparison(comparisonId)),

  listScenarios: (params) => api.getPaged(endpoints.simulation.scenarios, { params }),

  createScenario: (payload) => api.post(endpoints.simulation.scenarios, payload),

  validateScenario: (scenarioId) =>
    api.post(endpoints.simulation.validateScenario(scenarioId)),

  getUsage: () => api.get(endpoints.simulation.usage),
};