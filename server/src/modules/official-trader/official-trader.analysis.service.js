/**
 * SyncExc Server — Official AI Trader deterministic validation
 *
 * No order can be submitted for an official analysis until every check below
 * has passed. The AI has no ability to skip or override these checks.
 */

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors.js';
import { resolveBracketProtectionPlan } from '../connections/bracket-protection.policy.js';
import {
  alignToTick,
  isTickAligned,
  isWithinSchedule,
  maxDrawdownPercent,
  roundToStep,
  validateTradeLevels,
} from './official-trader.strategy.js';

export function createOfficialTraderAnalysisService({
  db,
  queries,
  connections,
  risk,
  logger,
  getProvider,
  recordEvent,
}) {
  async function validateAnalysis({ analysisId, actorId = null, force = false }) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    const analysis = await queries.getAnalysis(provider.id, analysisId);
    if (!analysis) throw new NotFoundError('Official analysis');
    if (!force && !['generated', 'rejected'].includes(analysis.status)) {
      throw new ConflictError(
        `Analysis in status ${analysis.status} cannot be re-validated`,
        'ANALYSIS_NOT_VALIDATABLE',
      );
    }

    const checks = [];
    const assignment = await queries.findAssignmentByConnectionAccount(
      provider.id,
      analysis.connection_id,
      analysis.account_id,
    );
    const instrument = assignment
      ? await connections.getInstrument({
          exchangeCode: assignment.exchange_code,
          symbol: analysis.instrument,
          marketType: analysis.market_type,
        })
      : null;
    const adapter = assignment
      ? await connections.getAdapter(assignment.exchange_code)
      : null;

    checks.push(check('settings_status', provider.settings_status === 'enabled',
      `Official trader status is ${provider.settings_status}`));
    checks.push(check('research_enabled', Boolean(provider.research_enabled),
      'Research must be enabled'));
    checks.push(check('connection_assigned', Boolean(assignment),
      'An active official exchange assignment is required'));
    checks.push(check('connection_active',
      assignment?.status === 'active' && assignment?.connection_status === 'active' &&
      assignment?.account_status === 'active',
      'The assigned connection and account must be active'));
    checks.push(check('instrument_exists',
      Boolean(instrument) && instrument.trading_status === 'active',
      'The instrument must exist and be tradable'));
    checks.push(check('exchange_adapter', Boolean(adapter),
      'The exchange adapter must be available'));
    checks.push(check('market_type_allowed',
      (provider.allowed_market_types || []).includes(analysis.market_type) &&
      (!assignment || (assignment.allowed_market_types || []).includes(analysis.market_type)),
      `Market type ${analysis.market_type} is not allowed`));
    checks.push(check('strategy_allowed',
      (provider.allowed_strategies || []).includes(analysis.strategy_key),
      `Strategy ${analysis.strategy_key} is not allowed`));
    checks.push(check('confidence',
      Number(analysis.confidence) >= Number(provider.min_confidence),
      `Confidence ${analysis.confidence} is below the configured minimum`));
    checks.push(check('expiry',
      !analysis.expires_at || new Date(analysis.expires_at).getTime() > Date.now(),
      'The analysis has expired'));

    const targets = Array.isArray(analysis.targets) ? analysis.targets : [];
    const levelError = validateTradeLevels({
      direction: analysis.direction,
      entry: analysis.entry_price,
      stopLoss: analysis.stop_loss,
      targets,
    });
    checks.push(check('trade_levels', !levelError, levelError || 'Trade levels are valid'));

    if (instrument) {
      checks.push(check('entry_tick',
        isTickAligned(analysis.entry_price, instrument.tick_size),
        `Entry must align with tick size ${instrument.tick_size}`));
      checks.push(check('stop_tick',
        isTickAligned(analysis.stop_loss, instrument.tick_size),
        `Stop-loss must align with tick size ${instrument.tick_size}`));
      checks.push(check('target_tick',
        targets.every((target) => isTickAligned(target, instrument.tick_size)),
        `Targets must align with tick size ${instrument.tick_size}`));
    }

    if (assignment && adapter) {
      const bracketPlan = resolveBracketProtectionPlan({
        capabilities: adapter.capabilities,
        marketType: analysis.market_type,
        orderType: analysis.order_type || 'market',
        stopLoss: analysis.stop_loss,
        takeProfit: targets[0] || null,
      });
      checks.push(check('exchange_protection',
        bracketPlan.supported,
        bracketPlan.warning || 'Exchange-managed stop-loss and take-profit are supported'));
    }

    const scheduleOk = isWithinSchedule(provider.trading_schedule);
    checks.push(check('trading_schedule', scheduleOk,
      'Current time is outside the configured trading schedule'));

    if (assignment) {
      const paused = await findActivePause(provider.workspace_id, {
        exchangeCode: assignment.exchange_code,
        accountId: analysis.account_id,
        instrumentId: instrument?.id,
      });
      checks.push(check('emergency_pause', !paused,
        paused ? `Trading is paused by an active ${paused.scope_type} emergency stop` : 'No emergency stop is active'));
    }

    let currentPrice = null;
    if (assignment) {
      try {
        const candles = await connections.marketData.getCandles({
          exchangeCode: assignment.exchange_code,
          symbol: analysis.instrument,
          marketType: analysis.market_type,
          timeframe: analysis.timeframe,
          limit: 10,
        });
        const last = candles.candles?.at(-1);
        currentPrice = last ? Number(last.close) : null;
      } catch (error) {
        logger.warn({ err: error, analysisId }, 'Official validation could not load the latest price');
      }
    }
    checks.push(check('market_price', Number.isFinite(currentPrice) && currentPrice > 0,
      'A current exchange price is required'));
    if (Number.isFinite(currentPrice) && analysis.entry_price) {
      const slippageBps = (Math.abs(Number(analysis.entry_price) - currentPrice) / currentPrice) * 10000;
      const maxSlippage = assignment?.max_slippage_bps ?? provider.max_slippage_bps;
      checks.push(check('entry_slippage', slippageBps <= maxSlippage,
        `Entry is ${slippageBps.toFixed(1)} bps from the current price; limit is ${maxSlippage} bps`));
    }

    const limits = resolveLimits(provider, assignment);
    checks.push(check('risk_per_trade',
      Number(analysis.risk_percentage || provider.max_risk_per_trade_pct) <= Number(limits.maxRiskPerTradePct),
      `Risk per trade exceeds the ${limits.maxRiskPerTradePct}% limit`));
    checks.push(check('leverage',
      Number(analysis.leverage || 1) <= Number(limits.maxLeverage),
      `Leverage exceeds the ${limits.maxLeverage}x limit`));

    if (assignment && instrument && adapter) {
      const balance = await loadAvailableBalance({ assignment, instrument, adapter });
      checks.push(check('balance_available', balance.ok, balance.message));

      if (balance.ok && currentPrice) {
        const sizing = sizePosition({
          analysis,
          instrument,
          availableQuote: balance.availableQuote,
          limits,
          price: Number(analysis.entry_price) || currentPrice,
        });
        checks.push(check('position_sizing', sizing.ok, sizing.message));
        if (sizing.ok) {
          checks.push(check('minimum_notional', sizing.notional >= Number(instrument.minimum_notional || 0),
            `Order notional ${sizing.notional} is below the exchange minimum`));
          checks.push(check('max_order_notional', sizing.notional <= Number(limits.maxOrderNotional),
            `Order notional ${sizing.notional} exceeds the ${limits.maxOrderNotional} limit`));
        }

        const [aggregates, exposure, realizedToday, dailySeries] = await Promise.all([
          queries.executionAggregates(provider.id),
          queries.exposureToday(provider.id),
          queries.realizedToday(provider.id),
          queries.dailyPerformance(provider.id),
        ]);
        checks.push(check('max_open_positions',
          Number(aggregates.open_positions) < Number(limits.maxOpenPositions),
          `The official trader already has ${aggregates.open_positions} open position(s); limit is ${limits.maxOpenPositions}`));
        const projectedExposure = Number(exposure.notional || 0) + (sizing.ok ? sizing.notional : 0);
        checks.push(check('daily_exposure',
          projectedExposure <= Number(limits.maxDailyExposure),
          `Projected daily exposure ${projectedExposure.toFixed(2)} exceeds the ${limits.maxDailyExposure} limit`));
        checks.push(check('daily_loss',
          Number(realizedToday) > -Math.abs(Number(limits.maxDailyLoss)),
          `Realized loss today ${realizedToday} has reached the ${limits.maxDailyLoss} limit`));
        const drawdown = maxDrawdownPercent(
          dailySeries.filter((point) => point.pnl_asset === 'USDT'),
        );
        checks.push(check('drawdown', drawdown <= Number(limits.maxDrawdownPct),
          `Drawdown ${drawdown.toFixed(2)}% exceeds the ${limits.maxDrawdownPct}% limit`));

        if (sizing.ok) {
          analysis.computed_position_size = sizing.quantity;
          analysis.computed_order_notional = sizing.notional;
        }
      }
    }

    const failures = checks.filter((entry) => !entry.passed);
    const now = new Date();
    const validationResult = {
      validatedAt: now.toISOString(),
      checks,
      failedChecks: failures.map((entry) => entry.check),
      currentPrice,
      limits,
      executionEnabled: Boolean(provider.execution_enabled),
      publicationMode: provider.publication_mode,
    };

    let status = 'validated';
    let rejectionReason = null;
    if (failures.length > 0) {
      status = 'rejected';
      rejectionReason = failures[0].detail;
    } else if (!provider.execution_enabled || provider.publication_mode === 'research_only') {
      status = 'research_only';
      rejectionReason = provider.publication_mode === 'research_only'
        ? 'Publication mode is research-only; this analysis is excluded from live performance'
        : 'Execution is disabled; this analysis is research-only and excluded from live performance';
    }

    const updated = await queries.updateAnalysis(analysis.id, {
      status,
      validationResult,
      rejectionReason,
      validatedAt: status === 'rejected' ? null : now,
      positionSize: analysis.computed_position_size || null,
      orderType: analysis.order_type || null,
    });

    await recordEvent({
      providerId: provider.id,
      analysisId: analysis.id,
      eventType: status === 'rejected' ? 'analysis.rejected' : 'analysis.validated',
      message: status === 'rejected'
        ? `Validation rejected ${analysis.instrument}: ${rejectionReason}`
        : status === 'research_only'
          ? `Analysis marked research-only: ${rejectionReason}`
          : `Validation passed for ${analysis.instrument}`,
      payload: { checks, status },
      actorId,
    });

    return toPublicAnalysis(updated);
  }

  async function findActivePause(workspaceId, { exchangeCode, accountId, instrumentId }) {
    const scopes = [
      ['exchange_adapter', exchangeCode ? await queries.resolveExchangeAdapterId(exchangeCode) : null],
      ['destination_account', accountId],
      ['instrument', instrumentId],
    ];
    for (const [scope, scopeRef] of scopes) {
      if (!scopeRef) continue;
      const result = await risk.emergencyPause.isPaused({ workspaceId, scope, scopeRef });
      if (result.paused) return result.pause;
    }
    return null;
  }

  async function loadAvailableBalance({ assignment, instrument, adapter }) {
    try {
      const credentials = await connections.loadCredentials(assignment.connection_id);
      const balances = await adapter.fetchBalances({
        ...credentials,
        accountType: assignment.account_type,
        environment: assignment.connection_environment || assignment.environment,
      });
      const quoteAsset = String(instrument.quote_asset || 'USDT').toUpperCase();
      const candidates = [quoteAsset, 'USDT', 'USDC', 'BUSD'];
      let availableQuote = 0;
      let found = false;
      for (const asset of candidates) {
        const balance = balances.find(
          (entry) => String(entry.asset || '').toUpperCase() === asset,
        );
        if (balance) {
          availableQuote = Number(balance.free || 0);
          found = true;
          break;
        }
      }
      if (!found) {
        return { ok: false, availableQuote: 0, message: `No ${quoteAsset} balance was reported by the exchange` };
      }
      if (!Number.isFinite(availableQuote) || availableQuote <= 0) {
        return { ok: false, availableQuote, message: `Available ${quoteAsset} balance is zero` };
      }
      return { ok: true, availableQuote, message: `Available ${quoteAsset}: ${availableQuote}` };
    } catch (error) {
      logger.warn(
        { err: error, connectionId: assignment.connection_id },
        'Official validation could not load exchange balances',
      );
      return { ok: false, availableQuote: 0, message: 'Exchange balance could not be verified' };
    }
  }

  function sizePosition({ analysis, instrument, availableQuote, limits, price }) {
    const entry = Number(analysis.entry_price) || price;
    const stop = Number(analysis.stop_loss);
    const riskDistance = Math.abs(entry - stop);
    if (!Number.isFinite(entry) || !Number.isFinite(stop) || riskDistance <= 0) {
      return { ok: false, message: 'A valid entry and stop-loss are required for position sizing' };
    }
    const riskPercentage = Number(analysis.risk_percentage || 0);
    const riskAmount = availableQuote * (riskPercentage / 100);
    const rawQuantity = riskAmount / riskDistance;
    const maxByNotional = Number(limits.maxOrderNotional) / entry;
    // Leverage is not changed on the exchange by the official trader, so size
    // the entry against available quote balance at 1x.
    const maxByBalance = availableQuote / entry;
    const quantity = roundToStep(
      Math.min(rawQuantity, maxByNotional, maxByBalance),
      instrument.quantity_step,
      'floor',
    );
    if (!quantity) {
      return { ok: false, message: 'Computed position size is below the exchange quantity step' };
    }
    const minimum = Number(instrument.minimum_quantity || 0);
    if (minimum > 0 && quantity < minimum) {
      return { ok: false, message: `Computed position size ${quantity} is below the exchange minimum ${minimum}` };
    }
    const alignedPrice = alignToTick(entry, instrument.tick_size) || entry;
    return {
      ok: true,
      quantity: String(quantity),
      notional: Number((quantity * alignedPrice).toPrecision(12)),
      riskAmount: Number(riskAmount.toPrecision(12)),
      message: `Position size ${quantity} at ${alignedPrice} risks ${riskAmount.toFixed(2)} quote units`,
    };
  }

  return {
    validateAnalysis,
  };
}

function resolveLimits(provider, assignment) {
  return {
    maxRiskPerTradePct: provider.max_risk_per_trade_pct,
    maxOrderNotional: assignment?.max_order_notional ?? provider.max_order_notional,
    maxOpenPositions: assignment?.max_open_positions ?? provider.max_open_positions,
    maxDailyExposure: assignment?.max_daily_exposure ?? provider.max_daily_exposure,
    maxLeverage: assignment?.max_leverage ?? provider.max_leverage,
    maxDailyLoss: assignment?.max_daily_loss ?? provider.max_daily_loss,
    maxDrawdownPct: assignment?.max_drawdown_pct ?? provider.max_drawdown_pct,
    maxSlippageBps: assignment?.max_slippage_bps ?? provider.max_slippage_bps,
  };
}

function check(name, passed, detail) {
  return { check: name, passed: Boolean(passed), detail: detail || null };
}

export function toPublicAnalysis(row) {
  if (!row) return null;
  return {
    id: row.id,
    researchRunId: row.research_run_id,
    connectionId: row.connection_id,
    accountId: row.account_id,
    exchangeCode: row.exchange_code,
    instrument: row.instrument,
    marketType: row.market_type,
    direction: row.direction,
    strategyKey: row.strategy_key,
    timeframe: row.timeframe,
    orderType: row.order_type,
    entryPrice: row.entry_price,
    stopLoss: row.stop_loss,
    targets: row.targets || [],
    riskReward: row.risk_reward == null ? null : Number(row.risk_reward),
    positionSize: row.position_size,
    riskPercentage: row.risk_percentage == null ? null : Number(row.risk_percentage),
    leverage: row.leverage == null ? null : Number(row.leverage),
    confidence: Number(row.confidence),
    marketCondition: row.market_condition,
    reasoning: row.reasoning,
    invalidationCondition: row.invalidation_condition,
    dataSources: row.data_sources || [],
    indicators: row.indicators || {},
    status: row.status,
    validationResult: row.validation_result,
    rejectionReason: row.rejection_reason,
    publishedSignalId: row.published_signal_id,
    expiresAt: row.expires_at,
    validatedAt: row.validated_at,
    executedAt: row.executed_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

export default createOfficialTraderAnalysisService;
