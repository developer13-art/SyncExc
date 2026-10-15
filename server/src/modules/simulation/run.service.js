/**
 * SyncExc Server — Run service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createRunService({
  db,
  queries,
  backtestEngine,
  replayEngine,
  metricsService,
  events,
  logger,
}) {
  async function createBacktestRun({
    userId,
    workspaceId,
    environmentId,
    config,
  }) {
    const environment = await queries.findEnvironmentById(environmentId);
    if (!environment || environment.workspace_id !== workspaceId) {
      throw new NotFoundError('Environment');
    }
    if (environment.type !== 'historical_backtest' && environment.type !== 'paper_trading') {
      throw new ConflictError('Environment type does not support backtests', 'WRONG_ENV_TYPE');
    }

    // Basic config validation
    if (!config.datasetVersionId) {
      throw new ConflictError('datasetVersionId is required', 'MISSING_DATASET');
    }
    if (!config.startTime || !config.endTime) {
      throw new ConflictError('startTime and endTime are required', 'MISSING_WINDOW');
    }

    const run = await db.tx(async (tx) => {
      return queries.insertRun(tx, {
        environmentId,
        version: environment.current_version,
        state: 'queued',
        config,
        randomSeed: config.randomSeed || null,
        engineVersion: backtestEngine.version,
        createdBy: userId,
      });
    });

    // Execute asynchronously
    executeRun(run.id).catch((err) => {
      logger.error({ err, runId: run.id }, 'Backtest run failed');
    });

    return run;
  }

  async function executeRun(runId) {
    const run = await queries.findRunById(runId);
    if (!run) throw new NotFoundError('Run');
    if (run.state === 'running' || run.state === 'completed') return run;

    await queries.updateRun(runId, { state: 'running', startedAt: new Date() });

    const environment = await queries.findEnvironmentById(run.environment_id);

    let finalState = 'completed';
    let errorMessage = null;
    let executionResult = null;

    try {
      if (environment.type === 'historical_backtest' || environment.type === 'paper_trading') {
        executionResult = await backtestEngine.execute({
          run,
          environment,
          config: run.config,
        });
      } else if (environment.type === 'market_replay') {
        executionResult = await replayEngine.initialize({
          run,
          environment,
          config: run.config,
        });
      } else {
        // For unsupported env types, mark as completed with warnings
        executionResult = { warnings: ['Environment type not fully supported yet'] };
        finalState = 'completed_with_warnings';
      }

      if (executionResult?.warnings && executionResult.warnings.length > 0) {
        finalState = 'completed_with_warnings';
      }
    } catch (err) {
      logger.error({ err, runId }, 'Simulation execution failed');
      finalState = 'failed';
      errorMessage = err.message;
    }

    // Compute metrics
    let metrics = null;
    if (finalState !== 'failed') {
      try {
        metrics = await metricsService.computeMetrics({ runId });
      } catch (err) {
        logger.error({ err, runId }, 'Metrics computation failed');
      }
    }

    const updated = await queries.updateRun(runId, {
      state: finalState,
      completedAt: new Date(),
      errorMessage,
      metrics,
      warnings: executionResult?.warnings,
    });

    await db.tx(async (tx) => {
      await queries.insertResourceUsage(tx, {
        workspaceId: environment.workspace_id,
        runId,
        metric: 'run_completed',
        value: 1,
      });

      await events.publish(
        tx,
        finalState === 'failed' ? 'simulation.run_failed' : 'simulation.run_completed',
        {
          runId,
          environmentId: environment.id,
          state: finalState,
          metrics,
        },
        {
          workspaceId: environment.workspace_id,
          resourceType: 'simulation_run',
          resourceId: runId,
        }
      );
    });

    return updated;
  }

  async function listRuns({ workspaceId, environmentId, limit, cursor }) {
    if (environmentId) {
      return queries.listRuns(environmentId, { limit, cursor });
    }
    const rows = await queries.listRunsForWorkspace(workspaceId, { limit });
    return { rows, nextCursor: null };
  }

  async function getRun({ runId, workspaceId }) {
    const run = await queries.findRunById(runId);
    if (!run) throw new NotFoundError('Run');
    const environment = await queries.findEnvironmentById(run.environment_id);
    if (!environment || environment.workspace_id !== workspaceId) {
      throw new NotFoundError('Run');
    }

    const steps = await queries.listRunSteps(runId, { limit: 1000 });
    const orders = await queries.listOrdersForRun(runId);
    const fills = await queries.listFillsForRun(runId);
    const positions = await queries.listPositionsForRun(runId);
    const metrics = await queries.listMetricsForRun(runId);

    return { run, environment, steps, orders, fills, positions, metrics };
  }

  return {
    createBacktestRun,
    executeRun,
    listRuns,
    getRun,
  };
}

export default createRunService;