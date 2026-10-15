/**
 * SyncExc Server — Simulation module (Module 12)
 *
 * Owns:
 *   - simulation environments (paper trading, backtest, replay, scenario)
 *   - virtual accounts and ledgers
 *   - historical data ingestion and versioned datasets
 *   - backtest execution engine
 *   - market replay engine
 *   - simulated order/fill engine with multiple fill models
 *   - performance metrics and reports
 *   - comparison of runs
 *
 * Public API:
 *   simulation.runService.executeRun(runId)
 *   simulation.environment.getEnvironment(envId)
 */

import { createSimulationQueries } from './simulation.queries.js';
import { createEnvironmentService } from './environment.service.js';
import { createAccountService } from './account.service.js';
import { createLedgerService } from './ledger.service.js';
import { createDatasetService } from './dataset.service.js';
import { createRunService } from './run.service.js';
import { createReplayService } from './replay.service.js';
import { createMetricsService } from './metrics.service.js';
import { createComparisonService } from './comparison.service.js';
import { createScenarioService } from './scenario.service.js';
import { createSimulationRoutes } from './simulation.routes.js';
import { createBacktestEngine } from './engines/backtest-engine.js';
import { createReplayEngine } from './engines/replay-engine.js';
import { createFillEngine } from './engines/fill-engine.js';
import { createVirtualLedger } from './engines/virtual-ledger.js';
import { createOrderSimulator } from './engines/order-simulator.js';
import { createLogger } from '../../lib/logger.js';

export function createSimulationModule({ services }) {
  const logger = createLogger({ component: 'simulation' });

  const queries = createSimulationQueries({ db: services.db });

  const environmentService = createEnvironmentService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const accountService = createAccountService({
    db: services.db,
    queries,
    logger,
  });

  const ledgerService = createLedgerService({
    db: services.db,
    queries,
    logger,
  });

  const datasetService = createDatasetService({
    db: services.db,
    queries,
    logger,
  });

  const fillEngine = createFillEngine({ logger });

  const virtualLedger = createVirtualLedger({
    db: services.db,
    queries,
    ledgerService,
    logger,
  });

  const orderSimulator = createOrderSimulator({
    db: services.db,
    queries,
    fillEngine,
    virtualLedger,
    logger,
  });

  const backtestEngine = createBacktestEngine({
    db: services.db,
    queries,
    datasetService,
    orderSimulator,
    virtualLedger,
    logger,
  });

  const replayEngine = createReplayEngine({
    db: services.db,
    queries,
    datasetService,
    orderSimulator,
    logger,
  });

  const metricsService = createMetricsService({
    db: services.db,
    queries,
    logger,
  });

  const runService = createRunService({
    db: services.db,
    queries,
    backtestEngine,
    replayEngine,
    metricsService,
    events: services.events,
    logger,
  });

  const replayService = createReplayService({
    db: services.db,
    queries,
    replayEngine,
    logger,
  });

  const comparisonService = createComparisonService({
    db: services.db,
    queries,
    metricsService,
    logger,
  });

  const scenarioService = createScenarioService({
    db: services.db,
    queries,
    logger,
  });

  const routes = createSimulationRoutes({
    environmentService,
    accountService,
    runService,
    replayService,
    metricsService,
    comparisonService,
    scenarioService,
    datasetService,
    middleware: services.middleware,
  });

  const publicApi = {
    environment: {
      getEnvironment: (envId) => environmentService.getEnvironment(envId),
    },
    runService: {
      executeRun: (runId) => runService.executeRun(runId),
    },
  };

  return {
    name: 'simulation',
    routes,
    queries,
    environment: environmentService,
    account: accountService,
    ledger: ledgerService,
    dataset: datasetService,
    run: runService,
    replay: replayService,
    metrics: metricsService,
    comparison: comparisonService,
    scenario: scenarioService,
    backtestEngine,
    replayEngine,
    fillEngine,
    orderSimulator,
    virtualLedger,
    publicApi,

    async shutdown() {
      logger.debug('Simulation module shutdown');
    },
  };
}

export default createSimulationModule;