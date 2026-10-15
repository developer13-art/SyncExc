/**
 * SyncExc Server — Simulation controller
 */

import { success, created, paginated } from '../../lib/response.js';
import { serializeSimulationEnvironment, serializeSimulationRun } from '../../lib/serializers.js';

export function createSimulationController(services) {
  const {
    environmentService,
    accountService,
    runService,
    replayService,
    metricsService,
    comparisonService,
    scenarioService,
    datasetService,
  } = services;

  return {
    /* Environments */
    async listEnvironments(req, res) {
      const envs = await environmentService.listEnvironments({
        workspaceId: req.workspace.id,
        type: req.query.type,
      });
      return success(res, envs.map(serializeSimulationEnvironment));
    },

    async createEnvironment(req, res) {
      const env = await environmentService.createEnvironment({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        name: req.body.name,
        type: req.body.type,
        initialBalances: req.body.initialBalances,
        exchanges: req.body.exchanges,
      });
      return created(res, serializeSimulationEnvironment(env));
    },

    async getEnvironment(req, res) {
      const env = await environmentService.getEnvironment({
        environmentId: req.params.environmentId,
        workspaceId: req.workspace.id,
      });
      return success(res, serializeSimulationEnvironment(env));
    },

    async updateEnvironment(req, res) {
      const env = await environmentService.updateEnvironment({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        environmentId: req.params.environmentId,
        updates: req.body,
      });
      return success(res, serializeSimulationEnvironment(env));
    },

    async archiveEnvironment(req, res) {
      const env = await environmentService.archiveEnvironment({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        environmentId: req.params.environmentId,
      });
      return success(res, serializeSimulationEnvironment(env));
    },

    /* Accounts */
    async listAccounts(req, res) {
      const accounts = await accountService.listAccounts({
        environmentId: req.params.environmentId,
      });
      return success(res, accounts);
    },

    async getBalances(req, res) {
      const balances = await accountService.getBalances({
        accountId: req.params.accountId,
      });
      return success(res, balances);
    },

    async getLedger(req, res) {
      const ledger = await accountService.getLedger({
        accountId: req.params.accountId,
        limit: Number(req.query.limit) || 100,
      });
      return success(res, ledger);
    },

    /* Datasets */
    async listDatasets(req, res) {
      const datasets = await datasetService.listDatasets();
      return success(res, datasets);
    },

    async createDataset(req, res) {
      const result = await datasetService.createDataset({
        name: req.body.name,
        description: req.body.description,
        source: req.body.source,
        instrument: req.body.instrument,
        marketType: req.body.marketType,
        events: req.body.events,
      });
      return created(res, result);
    },

    /* Runs */
    async listRuns(req, res) {
      const { rows, nextCursor } = await runService.listRuns({
        workspaceId: req.workspace.id,
        environmentId: req.query.environmentId,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeSimulationRun), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async createBacktestRun(req, res) {
      const run = await runService.createBacktestRun({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        environmentId: req.params.environmentId,
        config: req.body,
      });
      return created(res, serializeSimulationRun(run));
    },

    async getRun(req, res) {
      const result = await runService.getRun({
        runId: req.params.runId,
        workspaceId: req.workspace.id,
      });
      return success(res, {
        run: serializeSimulationRun(result.run),
        environment: serializeSimulationEnvironment(result.environment),
        steps: result.steps,
        orders: result.orders,
        fills: result.fills,
        positions: result.positions,
        metrics: result.metrics,
      });
    },

    async getRunMetrics(req, res) {
      const metrics = await metricsService.listMetrics({ runId: req.params.runId });
      return success(res, metrics);
    },

    /* Replay */
    async startReplay(req, res) {
      const result = await replayService.startReplay({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        environmentId: req.params.environmentId,
        config: req.body,
      });
      return created(res, result);
    },

    async stepReplay(req, res) {
      const result = await replayService.stepReplay({
        runId: req.params.runId,
        count: req.body.count || 1,
      });
      return success(res, result);
    },

    async getReplaySession(req, res) {
      const session = await replayService.getSession({
        runId: req.params.runId,
        workspaceId: req.workspace.id,
      });
      return success(res, session);
    },

    /* Comparisons */
    async compareRuns(req, res) {
      const comparison = await comparisonService.compare({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        baselineRunId: req.body.baselineRunId,
        comparisonRunId: req.body.comparisonRunId,
      });
      return created(res, comparison);
    },

    async listComparisons(req, res) {
      const comparisons = await comparisonService.listComparisons({
        workspaceId: req.workspace.id,
      });
      return success(res, comparisons);
    },

    async getComparison(req, res) {
      const comparison = await comparisonService.getComparison({
        comparisonId: req.params.comparisonId,
        workspaceId: req.workspace.id,
      });
      return success(res, comparison);
    },

    /* Scenarios */
    async listScenarios(req, res) {
      const scenarios = await scenarioService.listScenarios({
        workspaceId: req.workspace.id,
      });
      return success(res, scenarios);
    },

    async createScenario(req, res) {
      const scenario = await scenarioService.createScenario({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        name: req.body.name,
        description: req.body.description,
        parameters: req.body.parameters,
      });
      return created(res, scenario);
    },

    async getScenario(req, res) {
      const result = await scenarioService.getScenario({
        scenarioId: req.params.scenarioId,
        workspaceId: req.workspace.id,
      });
      return success(res, result);
    },
  };
}

export default createSimulationController;