/**
 * SyncExc Server — Official AI Trader execution and reconciliation
 *
 * Execution is delegated to the terminal order-submission service so the
 * standard idempotency, exchange precision, balance, emergency-stop, and risk
 * checks always run. An analysis is published only after an exchange fill is
 * reconciled into an official execution record.
 */

import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors.js';
import { toPublicAnalysis } from './official-trader.analysis.service.js';

const ACTIVE_EXECUTION_STATUSES = [
  'pending',
  'awaiting_confirmation',
  'submitted',
  'partially_filled',
  'filled',
  'uncertain',
];

const OPEN_REPORTING_STATUSES = [
  'pending',
  'awaiting_confirmation',
  'submitted',
  'partially_filled',
  'filled',
  'uncertain',
  'reconciled',
];

export function createOfficialTraderExecutionService({
  db,
  queries,
  terminal,
  marketData,
  analysisService,
  publication,
  logger,
  getProvider,
  recordEvent,
  audit,
  notifyAdmins,
}) {
  let reconcileRunning = false;

  async function executeAnalysis({ analysisId, actorId = null, reason = null }) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    if (provider.settings_status !== 'enabled' || !provider.execution_enabled) {
      throw new ConflictError('Official trader execution is disabled', 'EXECUTION_DISABLED');
    }
    if (provider.publication_mode !== 'execution_verified') {
      throw new ConflictError('Official trader publication mode is research-only', 'RESEARCH_ONLY_MODE');
    }

    const analysisRow = await queries.getAnalysis(provider.id, analysisId);
    if (!analysisRow) throw new NotFoundError('Official analysis');
    if (!OPEN_REPORTING_STATUSES.includes(analysisRow.status) && analysisRow.status !== 'validated') {
      throw new ConflictError(`Analysis status ${analysisRow.status} is not executable`, 'ANALYSIS_NOT_EXECUTABLE');
    }
    if (analysisRow.published_signal_id) {
      throw new ConflictError('Analysis is already published', 'ALREADY_PUBLISHED');
    }

    const open = await db.query(
      `SELECT count(*)::int AS count FROM official_trader_executions
       WHERE analysis_id = $1 AND status = ANY($2::text[])`,
      [analysisId, ACTIVE_EXECUTION_STATUSES],
    );
    if ((open.rows[0]?.count || 0) > 0) {
      throw new ConflictError('An execution attempt for this analysis is already active', 'EXECUTION_IN_PROGRESS');
    }

    const validation = await analysisService.validateAnalysis({ analysisId, actorId, force: true });
    if (validation.status !== 'validated') {
      throw new ConflictError(
        `Analysis did not pass deterministic validation: ${validation.rejectionReason || validation.status}`,
        'VALIDATION_FAILED',
      );
    }

    const refreshed = await queries.getAnalysis(provider.id, analysisId);
    if (!refreshed.position_size) {
      throw new ValidationError('The validated analysis has no executable position size');
    }

    const executionNumber = await queries.nextExecutionNumber(analysisId);
    const side = refreshed.direction === 'long' ? 'buy' : 'sell';
    const orderType = refreshed.order_type || (refreshed.market_type === 'spot' ? 'limit' : 'market');
    const takeProfit = Array.isArray(refreshed.targets) ? refreshed.targets[0] : null;
    if (refreshed.stop_loss == null || takeProfit == null) {
      throw new ValidationError('Official executions require a stop-loss and take-profit');
    }

    const execution = await queries.insertExecution({
      analysisId,
      providerId: provider.id,
      connectionId: refreshed.connection_id,
      accountId: refreshed.account_id,
      executionNumber,
      instrument: refreshed.instrument,
      marketType: refreshed.market_type,
      side,
      orderType,
      requestedQuantity: refreshed.position_size,
      status: 'pending',
    });
    await queries.updateAnalysis(analysisId, { status: 'execution_pending' });

    const params = {
      userId: provider.user_id,
      workspaceId: provider.workspace_id,
      connectionId: refreshed.connection_id,
      accountId: refreshed.account_id,
      marketType: refreshed.market_type,
      instrumentId: refreshed.instrument,
      side,
      type: orderType,
      quantity: String(refreshed.position_size),
      ...(orderType === 'limit' ? { price: String(refreshed.entry_price) } : {}),
      stopLoss: String(refreshed.stop_loss),
      takeProfit: String(takeProfit),
      timeInForce: orderType === 'limit' ? 'GTC' : undefined,
      clientOrderId: buildClientOrderId(refreshed.id, executionNumber),
      idempotencyKey: `official-trader:${refreshed.id}:${executionNumber}`,
    };

    return submitExecution({
      provider,
      analysis: refreshed,
      execution,
      params,
      actorId,
      reason,
      confirmedExecutionRequestId: undefined,
    });
  }

  async function confirmExecution({ executionId, actorId = null, reason = null }) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    const execution = await queries.getExecution(provider.id, executionId);
    if (!execution) throw new NotFoundError('Official execution');
    if (execution.status !== 'awaiting_confirmation') {
      throw new ConflictError('Only executions awaiting risk confirmation can be confirmed', 'INVALID_STATE');
    }
    if (!execution.execution_request_id) {
      throw new ConflictError('The official execution has no pending risk approval', 'NO_APPROVAL');
    }
    const analysis = await queries.getAnalysis(provider.id, execution.analysis_id);
    if (!analysis) throw new NotFoundError('Official analysis');
    const takeProfit = Array.isArray(analysis.targets) ? analysis.targets[0] : null;
    const params = {
      userId: provider.user_id,
      workspaceId: provider.workspace_id,
      connectionId: execution.connection_id,
      accountId: execution.account_id,
      marketType: execution.market_type,
      instrumentId: execution.instrument,
      side: execution.side,
      type: execution.order_type,
      quantity: String(execution.requested_quantity),
      ...(execution.order_type === 'limit' ? { price: String(analysis.entry_price) } : {}),
      stopLoss: String(analysis.stop_loss),
      takeProfit: takeProfit == null ? undefined : String(takeProfit),
      timeInForce: execution.order_type === 'limit' ? 'GTC' : undefined,
      clientOrderId: execution.client_order_id,
      idempotencyKey: `official-trader:${analysis.id}:${execution.execution_number}`,
    };
    await recordEvent({
      providerId: provider.id,
      analysisId: analysis.id,
      executionId: execution.id,
      eventType: 'execution.confirmation_approved',
      message: reason || 'Administrator confirmed the official trade after a risk-policy review',
      actorId,
    });
    await audit({
      actorId,
      action: 'official_trader.execution.confirm',
      targetResource: 'official_trader_execution',
      targetId: execution.id,
      reason: reason || 'Administrator confirmed an official execution awaiting risk approval',
    });
    return submitExecution({
      provider,
      analysis,
      execution,
      params,
      actorId,
      reason,
      confirmedExecutionRequestId: execution.execution_request_id,
    });
  }

  async function submitExecution({
    provider,
    analysis,
    execution,
    params,
    actorId,
    reason,
    confirmedExecutionRequestId,
  }) {
    try {
      const result = await terminal.submitOrder(params, {
        source: 'official_ai_trader',
        ...(confirmedExecutionRequestId
          ? { confirmedExecutionRequestId }
          : {}),
      });

      if (result?.requiresConfirmation) {
        await queries.updateExecution(execution.id, {
          status: 'awaiting_confirmation',
          executionRequestId: result.executionRequest?.id || null,
          exchangeResponse: { requiresConfirmation: true, riskDecision: result.riskDecision || null },
        });
        await recordEvent({
          providerId: provider.id,
          analysisId: analysis.id,
          executionId: execution.id,
          eventType: 'execution.awaiting_confirmation',
          message: 'The official trade requires an administrator risk confirmation before submission',
          payload: { executionRequestId: result.executionRequest?.id || null },
          actorId,
        });
        await audit({
          actorId,
          action: 'official_trader.execution.requires_confirmation',
          targetResource: 'official_trader_execution',
          targetId: execution.id,
          reason: reason || 'Risk policy requires confirmation for the official execution',
          after: { riskDecision: result.riskDecision || null },
        });
        await notifyAdmins({
          eventType: 'official_trader.execution_approval',
          title: 'Official trade awaiting confirmation',
          message: `${analysis.instrument} ${analysis.direction} requires administrator confirmation before execution.`,
          priority: 'high',
          action: { type: 'official_trader_execution', executionId: execution.id },
        });
        const updated = await queries.getExecution(provider.id, execution.id);
        return toPublicExecution(updated);
      }

      const order = result?.order;
      if (!order) {
        throw new AppError('The terminal did not return an order for the official execution', {
          code: 'ORDER_NOT_RETURNED',
          status: 502,
          expose: true,
        });
      }
      await queries.updateExecution(execution.id, {
        tradingOrderId: order.id,
        executionRequestId: result.executionRequest?.id || execution.execution_request_id || null,
        exchangeOrderId: order.exchange_order_id || null,
        clientOrderId: order.client_order_id || params.clientOrderId,
        status: mapOrderStatus(order.status),
        exchangeResponse: {
          orderStatus: order.status,
          ambiguous: Boolean(result.ambiguous),
          replayed: Boolean(result.replayed),
        },
        submittedAt: order.created_at || new Date(),
      });
      await db.query(
        `UPDATE trading_orders
         SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
         WHERE id = $1`,
        [
          order.id,
          JSON.stringify({
            officialAnalysisId: analysis.id,
            officialExecutionId: execution.id,
          }),
        ],
      );
      await queries.updateAnalysis(analysis.id, { status: 'execution_pending' });
      await recordEvent({
        providerId: provider.id,
        analysisId: analysis.id,
        executionId: execution.id,
        eventType: 'execution.submitted',
        message: `Official order submitted: ${analysis.instrument} ${analysis.direction}`,
        payload: {
          orderId: order.id,
          exchangeOrderId: order.exchange_order_id || null,
          status: order.status,
          ambiguous: Boolean(result.ambiguous),
        },
        actorId,
      });
      await audit({
        actorId,
        action: 'official_trader.execution.submit',
        targetResource: 'official_trader_execution',
        targetId: execution.id,
        reason: reason || 'Official AI trader submitted a validated trade',
        after: { orderId: order.id, exchangeOrderId: order.exchange_order_id || null },
      });
      await notifyAdmins({
        eventType: 'official_trader.execution_submitted',
        title: 'Official trade submitted',
        message: `${analysis.instrument} ${analysis.direction} was accepted by ${analysis.exchange_code}.`,
        priority: 'normal',
        action: { type: 'official_trader_execution', executionId: execution.id },
      });

      if (['filled', 'partially_filled'].includes(order.status)) {
        await syncExecution(provider, execution.id);
      }
      const updated = await queries.getExecution(provider.id, execution.id);
      return toPublicExecution(updated);
    } catch (error) {
      const status = isUncertainError(error) ? 'uncertain' : 'failed';
      await queries.updateExecution(execution.id, {
        status,
        errorMessage: String(error.message || error).slice(0, 1000),
        exchangeResponse: {
          code: error.code || null,
          details: error.details || null,
          ambiguous: isUncertainError(error),
        },
      });
      if (error.code === 'RECONCILIATION_REQUIRED' || isUncertainError(error)) {
        await queries.updateAnalysis(analysis.id, {
          status: 'execution_pending',
        });
      } else {
        await queries.updateAnalysis(analysis.id, {
          status: 'failed',
          rejectionReason: `Execution failed: ${String(error.message || error).slice(0, 500)}`,
        });
      }
      await recordEvent({
        providerId: provider.id,
        analysisId: analysis.id,
        executionId: execution.id,
        eventType: status === 'uncertain' ? 'execution.uncertain' : 'execution.failed',
        message: String(error.message || error).slice(0, 1000),
        payload: { code: error.code || null },
        actorId,
      });
      await audit({
        actorId,
        action: 'official_trader.execution.failed',
        targetResource: 'official_trader_execution',
        targetId: execution.id,
        reason: String(error.message || error).slice(0, 1000),
        outcome: 'failure',
      });
      await notifyAdmins({
        eventType: 'official_trader.execution_failed',
        title: status === 'uncertain' ? 'Official execution outcome is uncertain' : 'Official execution failed',
        message: `${analysis.instrument} ${analysis.direction}: ${String(error.message || error).slice(0, 300)}`,
        priority: 'high',
        action: { type: 'official_trader_execution', executionId: execution.id },
      });
      throw error;
    }
  }

  async function syncExecution(provider, executionId) {
    const execution = await queries.getExecutionById(executionId);
    if (!execution || !execution.trading_order_id) return null;
    const { order, fills } = await terminal.getOrder(execution.trading_order_id);
    if (!order) return null;
    const copied = await queries.copyFills(execution.id);
    const totals = await queries.refreshExecutionFillTotals(execution.id);
    const verifiedFillCount = await db.query(
      `SELECT count(*)::int AS count, MIN(executed_at) AS first_fill_at
       FROM official_trader_fills WHERE execution_id = $1`,
      [execution.id],
    );
    const fillCount = verifiedFillCount.rows[0]?.count || 0;
    const mappedStatus = mapOrderStatus(order.status);
    await queries.updateExecution(execution.id, {
      status: mappedStatus === 'filled' && fillCount > 0 ? 'reconciled' : mappedStatus,
      exchangeOrderId: order.exchange_order_id || execution.exchange_order_id,
      filledQuantity: totals?.filled_quantity ?? order.filled_quantity ?? execution.filled_quantity,
      averageFillPrice: totals?.average_fill_price ?? order.average_fill_price ?? execution.average_fill_price,
      fees: totals?.fees ?? execution.fees,
      feeAsset: totals?.fee_asset ?? execution.fee_asset,
      lastReconciledAt: new Date(),
      errorMessage: order.rejection_reason || null,
    });

    if (fillCount === 0) return { executionId, status: mappedStatus, fills: 0, published: false };
    if (mappedStatus === 'reconciled' || mappedStatus === 'partially_filled') {
      const published = await publishVerifiedExecution(provider, executionId, {
        fills,
        order,
        copied,
      });
      await queries.updateAnalysis(execution.analysis_id, {
        status: mappedStatus === 'partially_filled' ? 'partially_executed' : 'executed',
        executedAt: executedTime(verifiedFillCount.rows[0]?.first_fill_at),
      });
      return { executionId, status: mappedStatus, fills: fillCount, published: Boolean(published) };
    }
    return { executionId, status: mappedStatus, fills: fillCount, published: false };
  }

  async function publishVerifiedExecution(provider, executionId, { order, copied }) {
    const execution = await queries.getExecution(provider.id, executionId);
    if (!execution) return null;
    const analysis = await queries.getAnalysis(provider.id, execution.analysis_id);
    if (!analysis || analysis.published_signal_id) return null;
    if (!['validated', 'executed', 'partially_executed', 'execution_pending'].includes(analysis.status)) {
      return null;
    }
    const fills = await queries.listFills(executionId);
    if (fills.length === 0) return null;
    const firstFill = fills[0];
    const averageFillPrice = execution.average_fill_price || order.average_fill_price;
    if (!averageFillPrice || Number(averageFillPrice) <= 0) {
      logger.warn({ executionId }, 'Official execution has fills but no verified average price; publication deferred');
      return null;
    }
    if (!Array.isArray(analysis.targets) || analysis.targets.length === 0 || analysis.stop_loss == null) {
      logger.warn({ executionId }, 'Official execution is missing validated stop-loss/targets; publication blocked');
      return null;
    }

    const volume = fills.reduce((sum, fill) => sum + Number(fill.quantity), 0);
    const fees = fills.reduce((sum, fill) => sum + Number(fill.fee_amount || 0), 0);
    const signal = await publication.publishSignal({
      userId: provider.user_id,
      workspaceId: provider.workspace_id,
      providerId: provider.id,
      instrument: execution.instrument,
      marketType: execution.market_type,
      direction: execution.side === 'buy' ? 'long' : 'short',
      orderType: 'market',
      entryTime: firstFill.executed_at,
      entry: String(averageFillPrice),
      stopLoss: String(analysis.stop_loss),
      targets: analysis.targets,
      leverage: null,
      validUntil: null,
      sourceAccountId: execution.account_id,
      sourceOrderId: execution.trading_order_id,
      sourceEvidence: {
        type: 'official_ai_verified_execution',
        analysisId: analysis.id,
        executionId: execution.id,
        exchange: execution.exchange_code || analysis.exchange_code,
        exchangeOrderId: execution.exchange_order_id,
        filledQuantity: execution.filled_quantity,
        averageFillPrice: String(averageFillPrice),
        verifiedVolume: volume,
        verifiedFees: fees,
        verification: 'exchange_fill_reconciled',
        strategy: analysis.strategy_key,
        confidence: Number(analysis.confidence),
        validationChecks: analysis.validation_result?.checks || [],
        reconciledAt: new Date().toISOString(),
      },
      disclosures: {
        risk: 'The official SyncExc AI Trader executes through a platform-controlled exchange account. Published entries link to reconciled exchange fills. Past performance does not guarantee future results.',
        performance: 'Performance is calculated from eligible closed official executions and excludes research-only analyses.',
      },
    });
    if (!signal?.id) return null;
    await queries.updateAnalysis(analysis.id, {
      status: 'published',
      publishedSignalId: signal.id,
      publishedAt: new Date(),
    });
    await queries.updateSettings(provider.id, { last_execution_at: new Date() });
    await recordEvent({
      providerId: provider.id,
      analysisId: analysis.id,
      executionId: execution.id,
      eventType: 'signal.published',
      message: `Verified official execution published as a marketplace signal`,
      payload: {
        signalId: signal.id,
        orderId: execution.trading_order_id,
        filledQuantity: execution.filled_quantity,
        averageFillPrice: String(averageFillPrice),
      },
    });
    await notifyAdmins({
      eventType: 'official_trader.signal_published',
      title: 'Official trade published',
      message: `${execution.instrument} ${analysis.direction} was filled and published to the marketplace.`,
      priority: 'normal',
      action: { type: 'official_trader_analysis', analysisId: analysis.id },
    });
    return signal;
  }

  async function reconcileNow({ actorId = null } = {}) {
    if (reconcileRunning) return { skipped: true, reason: 'Reconciliation is already running' };
    reconcileRunning = true;
    try {
      const provider = await getProvider();
      if (!provider) throw new NotFoundError('Official AI Trader provider');
      const assignments = await queries.listConnections(provider.id);
      const active = assignments.filter(
        (assignment) =>
          assignment.status === 'active' &&
          assignment.connection_status === 'active' &&
          assignment.account_status === 'active',
      );

      try {
        await terminal.service.reconcilePendingOrders({ limit: 200 });
      } catch (error) {
        logger.warn({ err: error }, 'Official trader terminal order reconciliation failed');
      }

      for (const assignment of active) {
        try {
          await terminal.service.syncAccountState({
            workspaceId: provider.workspace_id,
            accountId: assignment.account_id,
          });
        } catch (error) {
          logger.warn(
            { err: error, accountId: assignment.account_id },
            'Official trader account state sync failed',
          );
        }
      }

      const open = await queries.listOpenExecutions(provider.id);
      const results = [];
      for (const execution of open) {
        try {
          results.push(await syncExecution(provider, execution.id));
        } catch (error) {
          logger.warn({ err: error, executionId: execution.id }, 'Official execution reconciliation failed');
        }
      }

      let closures = 0;
      const filled = await db.query(
        `
        SELECT execution.*
        FROM official_trader_executions execution
        WHERE execution.provider_id = $1
          AND execution.closed_at IS NULL
          AND execution.filled_quantity > 0
          AND NOT EXISTS (
            SELECT 1 FROM official_trader_closures closure
            WHERE closure.execution_id = execution.id
          )
        ORDER BY execution.submitted_at ASC
        `,
        [provider.id],
      );
      for (const execution of filled.rows) {
        const attributed = await attributeClosure(provider, execution, actorId);
        if (attributed) closures += 1;
      }

      await queries.updateSettings(provider.id, { last_reconciled_at: new Date() });
      return {
        checked: open.length,
        results,
        closures,
        reconciledAt: new Date().toISOString(),
      };
    } finally {
      reconcileRunning = false;
    }
  }

  async function attributeClosure(provider, execution, actorId) {
    const closedTrades = await queries.findUnattributedClosedTrades(execution);
    if (closedTrades.length === 0) return null;
    const trade = closedTrades[0];
    const realizedPnl = Number(trade.realized_pnl);
    if (!Number.isFinite(realizedPnl)) return null;
    const outcome = realizedPnl > 0 ? 'win' : realizedPnl < 0 ? 'loss' : 'breakeven';
    const closure = await queries.insertClosure({
      executionId: execution.id,
      providerId: provider.id,
      tradingClosedTradeId: trade.id,
      closedAt: trade.closed_at,
      realizedPnl: String(trade.realized_pnl),
      fees: trade.fee_amount || 0,
      pnlAsset: trade.fee_asset || trade.pnl_asset || null,
      outcome,
      attributionEvidence: {
        attribution: 'official_execution_closed_trade',
        accountId: trade.account_id,
        instrument: trade.instrument,
        exchangeTradeId: trade.exchange_trade_id,
        exchangeOrderId: trade.exchange_order_id,
        entryPrice: trade.entry_price,
        exitPrice: trade.exit_price,
        quantity: trade.quantity,
      },
    });
    if (!closure) return null;
    await queries.updateExecution(execution.id, {
      status: 'reconciled',
      closedAt: trade.closed_at,
      realizedPnl: String(trade.realized_pnl),
      pnlAsset: trade.fee_asset || trade.pnl_asset || null,
      lastReconciledAt: new Date(),
    });
    await queries.updateAnalysis(execution.analysis_id, { status: 'executed' });
    await queries.closePublishedSignalForExecution(execution.id, {
      realizedPnl: String(trade.realized_pnl),
      pnlAsset: trade.fee_asset || trade.pnl_asset || null,
      closedAt: trade.closed_at,
    });
    await recordEvent({
      providerId: provider.id,
      analysisId: execution.analysis_id,
      executionId: execution.id,
      eventType: 'execution.closed',
      message: `Official execution closed with ${outcome} PnL`,
      payload: {
        closedTradeId: trade.id,
        realizedPnl: String(trade.realized_pnl),
        pnlAsset: trade.fee_asset || trade.pnl_asset || null,
        outcome,
      },
      actorId,
    });
    return closure;
  }

  async function listExecutionDetail(executionId) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    const execution = await queries.getExecution(provider.id, executionId);
    if (!execution) throw new NotFoundError('Official execution');
    const [fills, analysis] = await Promise.all([
      queries.listFills(executionId),
      queries.getAnalysis(provider.id, execution.analysis_id),
    ]);
    const order = execution.trading_order_id
      ? await terminal.getOrder(execution.trading_order_id).catch(() => null)
      : null;
    return {
      execution: toPublicExecution(execution),
      fills,
      order: order?.order || null,
      orderEvents: order?.events || [],
      analysis: toPublicAnalysis(analysis),
    };
  }

  return {
    executeAnalysis,
    confirmExecution,
    reconcileNow,
    syncExecution,
    listExecutionDetail,
  };
}

function mapOrderStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (['pending_submission', 'submitted', 'acknowledged'].includes(normalized)) return 'submitted';
  if (normalized === 'partially_filled') return 'partially_filled';
  if (normalized === 'filled') return 'filled';
  if (['canceled', 'expired'].includes(normalized)) return 'canceled';
  if (normalized === 'rejected') return 'rejected';
  if (normalized === 'unknown' || normalized === 'reconciliation_required') return 'uncertain';
  return 'pending';
}

function isUncertainError(error) {
  return ['RECONCILIATION_REQUIRED', 'EXCHANGE_OUTCOME_UNKNOWN', 'TIMEOUT'].includes(error?.code);
}

function buildClientOrderId(analysisId, executionNumber) {
  return `off-${String(analysisId).replace(/-/g, '').slice(0, 18)}-${executionNumber}`;
}

function executedTime(value) {
  return value ? new Date(value) : new Date();
}

export function toPublicExecution(row) {
  if (!row) return null;
  return {
    id: row.id,
    analysisId: row.analysis_id,
    executionNumber: row.execution_number,
    tradingOrderId: row.trading_order_id,
    executionRequestId: row.execution_request_id,
    exchangeOrderId: row.exchange_order_id,
    clientOrderId: row.client_order_id,
    exchangeCode: row.exchange_code || null,
    instrument: row.instrument,
    marketType: row.market_type,
    side: row.side,
    orderType: row.order_type,
    requestedQuantity: row.requested_quantity,
    filledQuantity: row.filled_quantity,
    averageFillPrice: row.average_fill_price,
    fees: row.fees,
    feeAsset: row.fee_asset,
    status: row.status,
    errorMessage: row.error_message,
    submittedAt: row.submitted_at,
    lastReconciledAt: row.last_reconciled_at,
    closedAt: row.closed_at,
    realizedPnl: row.realized_pnl,
    pnlAsset: row.pnl_asset,
    closureOutcome: row.closure_outcome || null,
    createdAt: row.created_at,
  };
}

export default createOfficialTraderExecutionService;
