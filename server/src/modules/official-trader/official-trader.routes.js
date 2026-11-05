/**
 * SyncExc Server — Official AI Trader admin routes
 *
 * Mounted inside the admin router, so every request has already passed admin
 * authentication. Each endpoint additionally requires an official trader
 * permission. These routes never expose exchange API secrets: connection
 * credentials are only ever accepted on creation and are encrypted by the
 * connections service.
 */

import { Router } from 'express';
import Joi from 'joi';
import { UuidSchema } from '@syncexc/shared';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { success } from '../../lib/response.js';
import { toPublicAnalysis } from './official-trader.analysis.service.js';

const ReasonSchema = Joi.string().trim().min(10).max(1000);
const Pagination = Joi.object({
  limit: Joi.number().integer().min(1).max(200).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

const UpdateSettingsSchema = Joi.object({
  fields: Joi.object().unknown(true).required(),
  reason: ReasonSchema.required(),
});

const ConnectExchangeSchema = Joi.object({
  exchange: Joi.string().trim().min(2).max(32).required(),
  environment: Joi.string().valid('live', 'testnet', 'demo').default('live'),
  label: Joi.string().trim().min(3).max(80).required(),
  credentials: Joi.object({
    apiKey: Joi.string().trim().min(8).max(512).required(),
    apiSecret: Joi.string().trim().min(8).max(512).required(),
    passphrase: Joi.string().trim().max(512).allow('').optional(),
  }).required(),
  accountType: Joi.string().trim().max(32).optional(),
  allowedMarketTypes: Joi.array().items(Joi.string().valid('spot', 'futures')).optional(),
  makeDefault: Joi.boolean().default(true),
  reason: ReasonSchema.required(),
});

const AssignConnectionSchema = Joi.object({
  connectionId: UuidSchema.required(),
  accountId: UuidSchema.required(),
  isDefault: Joi.boolean().default(false),
  allowedMarketTypes: Joi.array().items(Joi.string().valid('spot', 'futures')).optional(),
  allowedSymbols: Joi.array().items(Joi.string().trim().max(64)).optional(),
  limits: Joi.object({
    maxOrderNotional: Joi.number().positive().optional(),
    maxOpenPositions: Joi.number().integer().positive().optional(),
    maxDailyExposure: Joi.number().positive().optional(),
    maxLeverage: Joi.number().positive().optional(),
    maxDailyLoss: Joi.number().positive().optional(),
    maxDrawdownPct: Joi.number().min(0).max(100).optional(),
    maxSlippageBps: Joi.number().integer().positive().optional(),
  }).optional(),
  reason: ReasonSchema.required(),
});

const UpdateConnectionSchema = Joi.object({
  fields: Joi.object().unknown(true).required(),
  reason: ReasonSchema.required(),
});

const PauseSchema = Joi.object({
  scope: Joi.string().valid('workspace', 'exchange_adapter', 'destination_account').default('workspace'),
  scopeRef: Joi.string().trim().max(128).when('scope', {
    is: 'workspace',
    then: Joi.optional().allow(null, ''),
    otherwise: Joi.required(),
  }),
  reason: ReasonSchema.required(),
});

const ResumeSchema = Joi.object({
  pauseId: UuidSchema.optional(),
  reason: ReasonSchema.required(),
});

const RunResearchSchema = Joi.object({
  reason: ReasonSchema.required(),
});

const AnalysisActionSchema = Joi.object({
  reason: ReasonSchema.required(),
});

const ValidatePendingSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(10),
  reason: ReasonSchema.required(),
});

const ReconcileSchema = Joi.object({
  reason: ReasonSchema.optional(),
});

const SnapshotSchema = Joi.object({
  periodStart: Joi.date().iso().optional(),
  periodEnd: Joi.date().iso().optional(),
});

export function createOfficialTraderAdminRoutes({
  settings,
  research,
  analysis,
  execution,
  performance,
  queries,
  getProvider,
  risk,
  middleware,
}) {
  const router = Router();
  const requireView = middleware.requireAdminPermission('admin.official_trader.view');
  const requireManage = middleware.requireAdminPermission('admin.official_trader.manage');
  const handler = middleware.asyncHandler;

  router.get(
    '/overview',
    requireView,
    handler(async (_req, res) => {
      const [overview, performanceReport] = await Promise.all([
        settings.getOverview(),
        performance.getAdminPerformance(),
      ]);
      return success(res, {
        ...overview,
        performance: {
          metrics: performanceReport.metrics,
          byMarketType: performanceReport.byMarketType,
          byAsset: performanceReport.byAsset,
          open: performanceReport.open,
        },
      });
    }),
  );

  router.get(
    '/settings',
    requireView,
    handler(async (_req, res) => {
      const overview = await settings.getOverview();
      return success(res, overview);
    }),
  );

  router.patch(
    '/settings',
    requireManage,
    middleware.requireStepUp(),
    middleware.validateBody(UpdateSettingsSchema),
    handler(async (req, res) => {
      const result = await settings.updateSettings({
        actorId: req.auth.userId,
        fields: req.body.fields,
        reason: req.body.reason,
      });
      return success(res, result);
    }),
  );

  router.get(
    '/exchange-catalog',
    requireView,
    handler(async (_req, res) => {
      return success(res, await settings.getExchangeCatalog());
    }),
  );

  router.get(
    '/connections',
    requireView,
    handler(async (_req, res) => {
      return success(res, (await settings.getOverview()).connections);
    }),
  );

  router.get(
    '/available-connections',
    requireView,
    handler(async (_req, res) => {
      return success(res, await settings.listAvailableConnections());
    }),
  );

  router.post(
    '/connections/connect',
    requireManage,
    middleware.requireStepUp(),
    middleware.validateBody(ConnectExchangeSchema),
    handler(async (req, res) => {
      const assignment = await settings.connectExchange({
        actorId: req.auth.userId,
        exchange: req.body.exchange,
        environment: req.body.environment,
        label: req.body.label,
        credentials: req.body.credentials,
        accountType: req.body.accountType,
        allowedMarketTypes: req.body.allowedMarketTypes,
        makeDefault: req.body.makeDefault,
        reason: req.body.reason,
      });
      return success(res, assignment);
    }),
  );

  router.post(
    '/connections/assign',
    requireManage,
    middleware.requireStepUp(),
    middleware.validateBody(AssignConnectionSchema),
    handler(async (req, res) => {
      const assignment = await settings.assignExistingConnection({
        actorId: req.auth.userId,
        connectionId: req.body.connectionId,
        accountId: req.body.accountId,
        isDefault: req.body.isDefault,
        allowedMarketTypes: req.body.allowedMarketTypes,
        allowedSymbols: req.body.allowedSymbols,
        limits: req.body.limits,
      });
      return success(res, assignment);
    }),
  );

  router.patch(
    '/connections/:assignmentId',
    requireManage,
    middleware.validateParams(Joi.object({ assignmentId: UuidSchema.required() })),
    middleware.validateBody(UpdateConnectionSchema),
    handler(async (req, res) => {
      const assignment = await settings.updateConnection({
        actorId: req.auth.userId,
        assignmentId: req.params.assignmentId,
        fields: req.body.fields,
        reason: req.body.reason,
      });
      return success(res, assignment);
    }),
  );

  router.delete(
    '/connections/:assignmentId',
    requireManage,
    middleware.requireStepUp(),
    middleware.validateParams(Joi.object({ assignmentId: UuidSchema.required() })),
    middleware.validateBody(Joi.object({ reason: ReasonSchema.required() })),
    handler(async (req, res) => {
      const result = await settings.removeConnection({
        actorId: req.auth.userId,
        assignmentId: req.params.assignmentId,
        reason: req.body.reason,
      });
      return success(res, result);
    }),
  );

  router.post(
    '/pause',
    requireManage,
    middleware.requireStepUp(),
    middleware.validateBody(PauseSchema),
    handler(async (req, res) => {
      const result = await settings.emergencyPause({
        actorId: req.auth.userId,
        reason: req.body.reason,
        scope: req.body.scope,
        scopeRef: req.body.scopeRef || null,
      });
      return success(res, result);
    }),
  );

  router.post(
    '/resume',
    requireManage,
    middleware.requireStepUp(),
    middleware.validateBody(ResumeSchema),
    handler(async (req, res) => {
      const result = await settings.resume({
        actorId: req.auth.userId,
        pauseId: req.body.pauseId || null,
        reason: req.body.reason,
      });
      return success(res, result);
    }),
  );

  /* Research */
  router.get(
    '/research/runs',
    requireView,
    middleware.validateQuery(Pagination),
    handler(async (req, res) => {
      const provider = await requireProvider();
      const result = await queries.listResearchRuns(provider.id, {
        limit: Number(req.query.limit),
        offset: Number(req.query.offset),
      });
      return success(res, result);
    }),
  );

  router.get(
    '/research/runs/:runId',
    requireView,
    middleware.validateParams(Joi.object({ runId: UuidSchema.required() })),
    handler(async (req, res) => {
      const provider = await requireProvider();
      const run = await queries.getResearchRun(provider.id, req.params.runId);
      if (!run) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Research run not found' } });
      }
      const analyses = await queries.listAnalyses(provider.id, { limit: 200, offset: 0 });
      return success(res, {
        run,
        analyses: analyses.items
          .filter((row) => row.research_run_id === run.id)
          .map(toPublicAnalysis),
      });
    }),
  );

  router.post(
    '/research/run',
    requireManage,
    middleware.validateBody(RunResearchSchema),
    handler(async (req, res) => {
      const result = await research.runResearch({
        actorId: req.auth.userId,
        trigger: 'manual',
      });
      return success(res, result);
    }),
  );

  /* Analyses */
  router.get(
    '/analyses',
    requireView,
    middleware.validateQuery(Pagination.keys({
      status: Joi.string().valid(
        'generated', 'validated', 'rejected', 'execution_pending', 'executed',
        'partially_executed', 'published', 'expired', 'research_only', 'failed',
      ).optional(),
      marketType: Joi.string().valid('spot', 'futures').optional(),
      instrument: Joi.string().trim().max(64).optional(),
    })),
    handler(async (req, res) => {
      const provider = await requireProvider();
      const result = await queries.listAnalyses(provider.id, {
        status: req.query.status,
        marketType: req.query.marketType,
        instrument: req.query.instrument,
        limit: Number(req.query.limit),
        offset: Number(req.query.offset),
      });
      return success(res, result);
    }),
  );

  router.get(
    '/analyses/:analysisId',
    requireView,
    middleware.validateParams(Joi.object({ analysisId: UuidSchema.required() })),
    handler(async (req, res) => {
      const provider = await requireProvider();
      const row = await queries.getAnalysis(provider.id, req.params.analysisId);
      if (!row) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Analysis not found' } });
      }
      const executions = await queries.listExecutionsForAnalysis(row.id);
      return success(res, {
        analysis: toPublicAnalysis(row),
        executions,
      });
    }),
  );

  router.post(
    '/analyses/:analysisId/validate',
    requireManage,
    middleware.validateParams(Joi.object({ analysisId: UuidSchema.required() })),
    middleware.validateBody(Joi.object({ reason: ReasonSchema.required() })),
    handler(async (req, res) => {
      const result = await analysis.validateAnalysis({
        analysisId: req.params.analysisId,
        actorId: req.auth.userId,
        force: true,
      });
      return success(res, result);
    }),
  );

  router.post(
    '/analyses/validate-pending',
    requireManage,
    middleware.validateBody(ValidatePendingSchema),
    handler(async (req, res) => {
      const provider = await requireProvider();
      const pending = await queries.listExecutableAnalyses(provider.id, req.body.limit);
      const results = [];
      for (const row of pending) {
        try {
          results.push(await analysis.validateAnalysis({
            analysisId: row.id,
            actorId: req.auth.userId,
            force: true,
          }));
        } catch (error) {
          results.push({ id: row.id, error: error.message });
        }
      }
      return success(res, { validated: results.length, results });
    }),
  );

  router.post(
    '/analyses/:analysisId/execute',
    requireManage,
    middleware.requireStepUp(),
    middleware.validateParams(Joi.object({ analysisId: UuidSchema.required() })),
    middleware.validateBody(Joi.object({ reason: ReasonSchema.required() })),
    handler(async (req, res) => {
      const result = await execution.executeAnalysis({
        analysisId: req.params.analysisId,
        actorId: req.auth.userId,
        reason: req.body.reason,
      });
      return success(res, result);
    }),
  );

  /* Executions */
  router.get(
    '/executions',
    requireView,
    middleware.validateQuery(Pagination.keys({
      status: Joi.string().valid(
        'pending', 'awaiting_confirmation', 'submitted', 'partially_filled', 'filled',
        'canceled', 'rejected', 'failed', 'uncertain', 'reconciled', 'superseded',
      ).optional(),
      marketType: Joi.string().valid('spot', 'futures').optional(),
    })),
    handler(async (req, res) => {
      const provider = await requireProvider();
      const result = await queries.listExecutions(provider.id, {
        status: req.query.status,
        marketType: req.query.marketType,
        limit: Number(req.query.limit),
        offset: Number(req.query.offset),
      });
      return success(res, result);
    }),
  );

  router.get(
    '/executions/:executionId',
    requireView,
    middleware.validateParams(Joi.object({ executionId: UuidSchema.required() })),
    handler(async (req, res) => {
      return success(res, await execution.listExecutionDetail(req.params.executionId));
    }),
  );

  router.post(
    '/executions/:executionId/confirm',
    requireManage,
    middleware.requireStepUp(),
    middleware.validateParams(Joi.object({ executionId: UuidSchema.required() })),
    middleware.validateBody(Joi.object({ reason: ReasonSchema.required() })),
    handler(async (req, res) => {
      const result = await execution.confirmExecution({
        executionId: req.params.executionId,
        actorId: req.auth.userId,
        reason: req.body.reason,
      });
      return success(res, result);
    }),
  );

  router.post(
    '/executions/:executionId/sync',
    requireManage,
    middleware.validateParams(Joi.object({ executionId: UuidSchema.required() })),
    handler(async (req, res) => {
      const provider = await requireProvider();
      const executionRow = await queries.getExecution(provider.id, req.params.executionId);
      if (!executionRow) throw new NotFoundError('Official execution');
      if (!executionRow.trading_order_id) {
        throw new ConflictError(
          'This execution has not been submitted to an exchange yet',
          'EXECUTION_NOT_SUBMITTED',
        );
      }
      const result = await execution.syncExecution(provider, req.params.executionId);
      if (!result) {
        throw new ConflictError(
          'The exchange order could not be retrieved for reconciliation',
          'ORDER_NOT_AVAILABLE',
        );
      }
      return success(res, result);
    }),
  );

  router.post(
    '/reconcile',
    requireManage,
    middleware.validateBody(ReconcileSchema),
    handler(async (req, res) => {
      const result = await execution.reconcileNow({ actorId: req.auth.userId });
      return success(res, result);
    }),
  );

  /* Performance */
  router.get(
    '/performance',
    requireView,
    handler(async (req, res) => {
      const periodStart = req.query.periodStart ? new Date(req.query.periodStart) : null;
      const periodEnd = req.query.periodEnd ? new Date(req.query.periodEnd) : null;
      return success(res, await performance.getAdminPerformance({ periodStart, periodEnd }));
    }),
  );

  router.post(
    '/performance/snapshot',
    requireManage,
    middleware.validateBody(SnapshotSchema),
    handler(async (req, res) => {
      const result = await performance.createSnapshot({
        periodStart: req.body.periodStart ? new Date(req.body.periodStart) : null,
        periodEnd: req.body.periodEnd ? new Date(req.body.periodEnd) : null,
        actorId: req.auth.userId,
      });
      return success(res, result);
    }),
  );

  router.get(
    '/closures',
    requireView,
    middleware.validateQuery(Pagination),
    handler(async (req, res) => {
      const provider = await requireProvider();
      return success(res, await queries.listClosures(provider.id, {
        limit: Number(req.query.limit),
        offset: Number(req.query.offset),
      }));
    }),
  );

  /* Marketplace, subscribers, copy operations */
  router.get(
    '/marketplace',
    requireView,
    handler(async (_req, res) => {
      const provider = await requireProvider();
      const [summary, plans, signals] = await Promise.all([
        queries.marketplaceSummary(provider.id),
        queries.listProviderPlans(provider.id),
        queries.listPublishedSignals(provider.id, { limit: 20, offset: 0 }),
      ]);
      return success(res, { provider: settings.publicProvider(provider), summary, plans, signals });
    }),
  );

  router.get(
    '/signals',
    requireView,
    middleware.validateQuery(Pagination.keys({
      status: Joi.string().max(32).optional(),
    })),
    handler(async (req, res) => {
      const provider = await requireProvider();
      return success(res, await queries.listPublishedSignals(provider.id, {
        status: req.query.status,
        limit: Number(req.query.limit),
        offset: Number(req.query.offset),
      }));
    }),
  );

  router.get(
    '/subscribers',
    requireView,
    middleware.validateQuery(Pagination),
    handler(async (req, res) => {
      const provider = await requireProvider();
      return success(res, await queries.listSubscribers(provider.id, {
        limit: Number(req.query.limit),
        offset: Number(req.query.offset),
      }));
    }),
  );

  router.get(
    '/copy-operations',
    requireView,
    middleware.validateQuery(Pagination),
    handler(async (req, res) => {
      const provider = await requireProvider();
      return success(res, await queries.listCopyOperations(provider.id, {
        limit: Number(req.query.limit),
        offset: Number(req.query.offset),
      }));
    }),
  );

  /* Risk */
  router.get(
    '/risk',
    requireView,
    handler(async (_req, res) => {
      const provider = await requireProvider();
      const [overview, openExecutions, realizedToday, exposure, pauses] = await Promise.all([
        settings.getOverview(),
        queries.listOpenExecutions(provider.id),
        queries.realizedToday(provider.id),
        queries.exposureToday(provider.id),
        risk.emergencyPause.getActive({ workspaceId: provider.workspace_id }),
      ]);
      return success(res, {
        limits: overview.settings,
        openExecutions,
        realizedToday,
        exposure,
        pauses,
      });
    }),
  );

  /* Lifecycle events */
  router.get(
    '/events',
    requireView,
    middleware.validateQuery(Pagination.keys({
      eventType: Joi.string().trim().max(64).optional(),
    })),
    handler(async (req, res) => {
      const provider = await requireProvider();
      return success(res, await queries.listEvents(provider.id, {
        limit: Number(req.query.limit),
        offset: Number(req.query.offset),
        eventType: req.query.eventType,
      }));
    }),
  );

  async function requireProvider() {
    const provider = await getProvider();
    if (!provider) {
      const error = new Error('Official AI Trader provider is not provisioned');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    return provider;
  }

  return router;
}

export default createOfficialTraderAdminRoutes;
