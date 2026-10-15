/**
 * SyncExc Server — Simulation routes
 */

import { Router } from 'express';
import Joi from 'joi';
import { UuidSchema, PaginationSchema, TimeframeSchema } from '@syncexc/shared';
import { createSimulationController } from './simulation.controller.js';

const CreateEnvironmentSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  type: Joi.string()
    .valid('paper_trading', 'historical_backtest', 'market_replay', 'workflow_test', 'synchronization_test', 'scenario_test')
    .required(),
  initialBalances: Joi.array()
    .items(
      Joi.object({
        asset: Joi.string().uppercase().max(20).required(),
        amount: Joi.string().pattern(/^\d+(\.\d+)?$/).required(),
      })
    )
    .min(1)
    .required(),
  exchanges: Joi.array().items(Joi.string()).optional(),
});

const UpdateEnvironmentSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
}).min(1);

const CreateDatasetSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().max(500).optional(),
  source: Joi.string().required(),
  instrument: Joi.string().required(),
  marketType: Joi.string().valid('spot', 'futures', 'perpetual').required(),
  events: Joi.array().items(
    Joi.object({
      eventType: Joi.string().valid('trade', 'candle', 'order_book').required(),
      instrument: Joi.string().optional(),
      payload: Joi.object().unknown(true).required(),
      occurredAt: Joi.date().iso().required(),
    })
  ).min(1).required(),
});

const BacktestSchema = Joi.object({
  datasetVersionId: UuidSchema.required(),
  instrument: Joi.string().required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
  strategy: Joi.string().valid('buy_and_hold', 'periodic_buy', 'signal_driven', 'noop').default('buy_and_hold'),
  fillModel: Joi.string()
    .valid('immediate_simplified', 'trade_based', 'order_book_based', 'partial_fill', 'latency_aware', 'failure_injection')
    .default('immediate_simplified'),
  takerFeeBps: Joi.number().min(0).default(10),
  slippageBps: Joi.number().min(0).default(5),
  randomSeed: Joi.number().integer().optional(),
  intervalSteps: Joi.number().integer().min(1).optional(),
  quantityPerTrade: Joi.string().pattern(/^\d+(\.\d+)?$/).optional(),
  startingBalances: Joi.object().unknown(true).optional(),
});

const CompareSchema = Joi.object({
  baselineRunId: UuidSchema.required(),
  comparisonRunId: UuidSchema.required(),
});

const ReplayStartSchema = Joi.object({
  datasetVersionId: UuidSchema.required(),
  instrument: Joi.string().required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
  strategy: Joi.string().valid('buy_and_hold', 'noop').default('buy_and_hold'),
  fillModel: Joi.string().default('immediate_simplified'),
  takerFeeBps: Joi.number().min(0).default(10),
  slippageBps: Joi.number().min(0).default(5),
});

const ReplayStepSchema = Joi.object({
  count: Joi.number().integer().min(1).max(10000).default(1),
});

const CreateScenarioSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().max(500).optional(),
  parameters: Joi.object().unknown(true).required(),
});

export function createSimulationRoutes(services) {
  const controller = createSimulationController(services);
  const { middleware } = services;
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Environments
   * ------------------------------------------------------------------------ */
  router.get(
    '/environments',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listEnvironments)
  );

  router.post(
    '/environments',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CreateEnvironmentSchema),
    middleware.asyncHandler(controller.createEnvironment)
  );

  router.get(
    '/environments/:environmentId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getEnvironment)
  );

  router.patch(
    '/environments/:environmentId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(UpdateEnvironmentSchema),
    middleware.asyncHandler(controller.updateEnvironment)
  );

  router.post(
    '/environments/:environmentId/archive',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.archiveEnvironment)
  );

  /* ---------------------------------------------------------------------------
   * Accounts
   * ------------------------------------------------------------------------ */
  router.get(
    '/environments/:environmentId/accounts',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listAccounts)
  );

  router.get(
    '/accounts/:accountId/balances',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getBalances)
  );

  router.get(
    '/accounts/:accountId/ledger',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getLedger)
  );

  /* ---------------------------------------------------------------------------
   * Datasets
   * ------------------------------------------------------------------------ */
  router.get(
    '/datasets',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listDatasets)
  );

  router.post(
    '/datasets',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CreateDatasetSchema),
    middleware.asyncHandler(controller.createDataset)
  );

  /* ---------------------------------------------------------------------------
   * Runs
   * ------------------------------------------------------------------------ */
  router.get(
    '/runs',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listRuns)
  );

  router.post(
    '/environments/:environmentId/backtests',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(BacktestSchema),
    middleware.asyncHandler(controller.createBacktestRun)
  );

  router.get(
    '/runs/:runId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getRun)
  );

  router.get(
    '/runs/:runId/metrics',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getRunMetrics)
  );

  /* ---------------------------------------------------------------------------
   * Replay
   * ------------------------------------------------------------------------ */
  router.post(
    '/environments/:environmentId/replays',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(ReplayStartSchema),
    middleware.asyncHandler(controller.startReplay)
  );

  router.post(
    '/runs/:runId/replay/step',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(ReplayStepSchema),
    middleware.asyncHandler(controller.stepReplay)
  );

  router.get(
    '/runs/:runId/replay',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getReplaySession)
  );

  /* ---------------------------------------------------------------------------
   * Comparisons
   * ------------------------------------------------------------------------ */
  router.post(
    '/comparisons',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CompareSchema),
    middleware.asyncHandler(controller.compareRuns)
  );

  router.get(
    '/comparisons',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listComparisons)
  );

  router.get(
    '/comparisons/:comparisonId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getComparison)
  );

  /* ---------------------------------------------------------------------------
   * Scenarios
   * ------------------------------------------------------------------------ */
  router.get(
    '/scenarios',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listScenarios)
  );

  router.post(
    '/scenarios',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CreateScenarioSchema),
    middleware.asyncHandler(controller.createScenario)
  );

  router.get(
    '/scenarios/:scenarioId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getScenario)
  );

  return router;
}

export default createSimulationRoutes;