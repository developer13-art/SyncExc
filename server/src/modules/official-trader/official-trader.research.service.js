/**
 * SyncExc Server — Official AI Trader research
 *
 * Research reads real exchange candles, computes deterministic indicators, and
 * asks the configured AI provider for structured trade proposals. The AI never
 * executes anything; proposals are stored as analyses and must pass the
 * deterministic validation and risk checks before an order can be submitted.
 */

import { ValidationError } from '../../lib/errors.js';
import {
  computeIndicators,
  evaluateStrategy,
  validateTradeLevels,
} from './official-trader.strategy.js';

const LIQUID_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT',
  'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'SUIUSDT', 'LTCUSDT', 'TONUSDT',
];
const MAX_RESEARCH_SYMBOLS = 6;
const ANALYSIS_TTL_MINUTES = 45;

export function createOfficialTraderResearchService({
  db,
  queries,
  connections,
  ai,
  events,
  logger,
  getProvider,
  recordEvent,
}) {
  let running = false;

  async function runResearch({ actorId = null, trigger = 'schedule' } = {}) {
    if (running) return { skipped: true, reason: 'A research run is already in progress' };
    running = true;
    try {
      const provider = await getProvider();
      if (!provider) throw new ValidationError('The official trader provider is not provisioned');
      if (provider.settings_status !== 'enabled') {
        return { skipped: true, reason: `Official trader is ${provider.settings_status}` };
      }
      if (!provider.research_enabled) {
        return { skipped: true, reason: 'Research is disabled in official trader settings' };
      }

      const assignments = await queries.listConnections(provider.id);
      const activeAssignments = assignments.filter(
        (assignment) =>
          assignment.status === 'active' &&
          assignment.connection_status === 'active' &&
          assignment.account_status === 'active',
      );
      if (activeAssignments.length === 0) {
        return { skipped: true, reason: 'No active official exchange account is assigned' };
      }

      const universe = await buildUniverse(provider, activeAssignments);
      if (universe.length === 0) {
        return { skipped: true, reason: 'No eligible active instruments are available for the assigned exchanges' };
      }

      const selected = rotateUniverse(universe, provider.id, Date.now());
      const primaryTimeframe = provider.primary_timeframe || '1h';
      const researchTimeframes = (provider.research_timeframes || []).includes(primaryTimeframe)
        ? provider.research_timeframes
        : [primaryTimeframe];

      const run = await queries.insertResearchRun({
        providerId: provider.id,
        status: 'running',
        timeframes: researchTimeframes,
        symbols: selected.map(({ symbol, exchangeCode, marketType }) => ({
          symbol,
          exchangeCode,
          marketType,
          timeframe: primaryTimeframe,
        })),
        dataSources: [{ type: 'exchange_candles', timeframe: primaryTimeframe }],
        aiProvider: ai?.chatJson ? 'configured_ai' : 'deterministic_engine',
        aiModel: null,
      });

      let snapshots;
      try {
        snapshots = await loadSnapshots({
          provider,
          selected,
          timeframe: primaryTimeframe,
        });
      } catch (error) {
        await queries.finishResearchRun(run.id, {
          status: 'failed',
          errorMessage: error.message,
          summary: { trigger, failure: 'market_data' },
        });
        throw error;
      }

      if (snapshots.length === 0) {
        await queries.finishResearchRun(run.id, {
          status: 'skipped',
          summary: { trigger, reason: 'No usable market-data snapshots' },
        });
        return { skipped: true, reason: 'No usable market-data snapshots', runId: run.id };
      }

      let candidates;
      let engine = 'ai';
      try {
        candidates = await researchWithAi({ provider, snapshots, timeframe: primaryTimeframe });
        if (!ai?.chatJson) {
          engine = 'deterministic';
          candidates = deterministicCandidates({ provider, snapshots, timeframe: primaryTimeframe });
        }
      } catch (error) {
        logger.warn(
          { err: error, providerId: provider.id },
          'Official trader AI research failed; using the deterministic strategy engine',
        );
        engine = 'deterministic';
        candidates = deterministicCandidates({ provider, snapshots, timeframe: primaryTimeframe });
        await recordEvent({
          providerId: provider.id,
          eventType: 'research.ai_fallback',
          message: `AI research failed (${error.code || error.name}); deterministic engine used`,
          payload: { error: error.message, runId: run.id },
          actorId,
        });
      }

      const created = [];
      let rejected = 0;
      for (const candidate of candidates) {
        if (created.length >= provider.max_analyses_per_run) break;
        const assignment = selectAssignment(activeAssignments, candidate);
        if (!assignment) {
          rejected += 1;
          continue;
        }
        const active = await queries.findActiveAnalysisForInstrument(provider.id, {
          exchangeCode: candidate.exchangeCode,
          instrument: candidate.instrument,
          marketType: candidate.marketType,
        });
        if (active) {
          rejected += 1;
          continue;
        }
        try {
          const analysis = await queries.insertAnalysis({
            providerId: provider.id,
            researchRunId: run.id,
            connectionId: assignment.connection_id,
            accountId: assignment.account_id,
            exchangeCode: candidate.exchangeCode,
            instrument: candidate.instrument,
            marketType: candidate.marketType,
            direction: candidate.direction,
            strategyKey: candidate.strategyKey,
            timeframe: candidate.timeframe,
            orderType: preferredOrderType(assignment, candidate.marketType),
            entryPrice: candidate.entry,
            stopLoss: candidate.stopLoss,
            targets: candidate.targets,
            riskReward: candidate.riskReward,
            riskPercentage: provider.max_risk_per_trade_pct,
            leverage: null,
            confidence: candidate.confidence,
            marketCondition: candidate.marketCondition,
            reasoning: candidate.reasoning,
            invalidationCondition: candidate.invalidationCondition,
            dataSources: candidate.dataSources,
            indicators: candidate.indicators,
            status: 'generated',
            expiresAt: new Date(Date.now() + ANALYSIS_TTL_MINUTES * 60 * 1000),
          });
          created.push(analysis);
          await recordEvent({
            providerId: provider.id,
            analysisId: analysis.id,
            eventType: 'analysis.generated',
            message: `${candidate.direction} ${candidate.instrument} proposal generated by ${engine}`,
            payload: {
              runId: run.id,
              exchange: candidate.exchangeCode,
              marketType: candidate.marketType,
              confidence: candidate.confidence,
              strategy: candidate.strategyKey,
            },
            actorId,
          });
        } catch (error) {
          rejected += 1;
          logger.warn({ err: error, candidate }, 'Official trader analysis could not be stored');
        }
      }

      await queries.updateSettings(provider.id, { last_research_at: new Date() });
      await queries.finishResearchRun(run.id, {
        status: 'completed',
        candidatesGenerated: candidates.length,
        analysesCreated: created.length,
        rejected,
        summary: {
          trigger,
          engine,
          symbolsScanned: snapshots.length,
          candidateCount: candidates.length,
          analysesCreated: created.length,
          skippedByActiveAnalysis: rejected,
        },
      });

      logger.info(
        {
          providerId: provider.id,
          runId: run.id,
          engine,
          snapshots: snapshots.length,
          candidates: candidates.length,
          created: created.length,
        },
        'Official trader research run completed',
      );

      return {
        runId: run.id,
        engine,
        symbolsScanned: snapshots.length,
        candidates: candidates.length,
        analyses: created,
        rejected,
      };
    } finally {
      running = false;
    }
  }

  async function buildUniverse(provider, assignments) {
    const exchangeCodes = [...new Set(assignments.map((assignment) => assignment.exchange_code))];
    const marketTypes = new Set(provider.allowed_market_types || ['futures']);
    const result = await db.query(
      `
      SELECT id, exchange_code, exchange_symbol, normalized_symbol, market_type,
             base_asset, quote_asset, tick_size, quantity_step,
             minimum_quantity, minimum_notional, trading_status
      FROM exchange_instruments
      WHERE exchange_code = ANY($1::text[])
        AND market_type = ANY($2::text[])
        AND trading_status = 'active'
      ORDER BY exchange_code, normalized_symbol
      `,
      [exchangeCodes, [...marketTypes]],
    );
    const bySymbol = new Map();
    for (const instrument of result.rows) {
      const symbol = String(instrument.normalized_symbol || '').toUpperCase();
      if (!/^[A-Z0-9]{3,48}$/.test(symbol)) continue;
      const assignment = assignments.find(
        (candidate) =>
          candidate.exchange_code === instrument.exchange_code &&
          (candidate.allowed_market_types || []).includes(instrument.market_type) &&
          (!Array.isArray(candidate.allowed_symbols) ||
            candidate.allowed_symbols.length === 0 ||
            candidate.allowed_symbols.includes(symbol)),
      );
      if (!assignment) continue;
      const key = `${symbol}:${instrument.market_type}`;
      const existing = bySymbol.get(key);
      const rank = liquidityRank(symbol);
      if (!existing || rank < existing.rank) {
        bySymbol.set(key, {
          symbol,
          exchangeCode: instrument.exchange_code,
          exchangeSymbol: instrument.exchange_symbol,
          marketType: instrument.market_type,
          assignmentId: assignment.id,
          instrument,
          rank,
        });
      }
    }
    const universe = [...bySymbol.values()].filter((entry) => entry.rank < 100);
    universe.sort((a, b) => a.rank - b.rank || a.symbol.localeCompare(b.symbol));
    return universe;
  }

  function rotateUniverse(universe, providerId, now) {
    if (universe.length <= MAX_RESEARCH_SYMBOLS) return universe;
    const batchCount = Math.ceil(universe.length / MAX_RESEARCH_SYMBOLS);
    const batchIndex = Math.floor(now / (15 * 60 * 1000)) % batchCount;
    const start = batchIndex * MAX_RESEARCH_SYMBOLS;
    return Array.from(
      { length: MAX_RESEARCH_SYMBOLS },
      (_, index) => universe[(start + index) % universe.length],
    );
  }

  async function loadSnapshots({ provider, selected, timeframe }) {
    const snapshots = [];
    for (const entry of selected) {
      try {
        const result = await connections.marketData.getCandles({
          exchangeCode: entry.exchangeCode,
          symbol: entry.symbol,
          marketType: entry.marketType,
          timeframe,
          limit: 150,
        });
        const candles = result?.candles || [];
        const indicators = computeIndicators(candles);
        if (!indicators) continue;
        snapshots.push({
          ...entry,
          timeframe,
          candles,
          indicators,
          retrievedAt: result.retrievedAt || new Date().toISOString(),
          dataSource: {
            type: 'exchange_market_data',
            exchange: entry.exchangeCode,
            symbol: entry.symbol,
            marketType: entry.marketType,
            timeframe,
            candleCount: candles.length,
            retrievedAt: result.retrievedAt || new Date().toISOString(),
          },
        });
      } catch (error) {
        logger.warn(
          { err: error, exchange: entry.exchangeCode, symbol: entry.symbol },
          'Official trader market-data snapshot failed',
        );
      }
    }
    return snapshots;
  }

  async function researchWithAi({ provider, snapshots, timeframe }) {
    if (!ai?.chatJson) return deterministicCandidates({ provider, snapshots, timeframe });
    const allowedStrategies = provider.allowed_strategies || ['trend_following', 'breakout', 'momentum'];
    const payload = {
      currentTime: new Date().toISOString(),
      primaryTimeframe: timeframe,
      maximumAnalyses: provider.max_analyses_per_run,
      allowedStrategies,
      allowedMarketTypes: provider.allowed_market_types,
      minimumRiskReward: 1.5,
      markets: snapshots.map((snapshot) => ({
        symbol: snapshot.symbol,
        exchange: snapshot.exchangeCode,
        marketType: snapshot.marketType,
        timeframe,
        lastPrice: snapshot.indicators.price,
        indicators: snapshot.indicators,
        recentCandles: snapshot.candles.slice(-24).map((candle) => ({
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        })),
      })),
    };
    const { data, model } = await ai.chatJson({
      system: [
        'You are the research engine for the official SyncExc AI trading service.',
        'You may analyse markets and propose trades, but you cannot execute, override risk limits, change exchange permissions, or publish signals.',
        'Use only the supplied exchange market snapshots. Do not invent prices, symbols, news, or data sources.',
        `Select at most ${provider.max_analyses_per_run} high-quality opportunities from the supplied markets.`,
        'Return JSON only: {"analyses":[{"symbol":"BTCUSDT","exchange":"bybit","marketType":"futures","direction":"long","strategyKey":"trend_following","confidence":0.82,"entry":"100","stopLoss":"98","targets":["104"],"reasoning":"...","invalidation":"...","marketCondition":"uptrend"}]}.',
        'Only propose short trades for futures markets. Spot trades must be long.',
        'Entry must be within 0.5% of the supplied last price. Stop-loss and targets must be positive and on the correct side of entry.',
        'Target at least 1.5x risk. Keep confidence honest and below 1. Return an empty analyses array when the evidence is weak.',
        `Allowed strategy keys: ${allowedStrategies.join(', ')}.`,
      ].join(' '),
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
      maxTokens: 2400,
      temperature: 0.1,
      rateKey: 'official-trader:research',
    });

    if (!Array.isArray(data?.analyses) || data.analyses.length > provider.max_analyses_per_run) {
      throw new ValidationError('AI returned an invalid official trader research payload');
    }
    const catalog = new Map(
      snapshots.map((snapshot) => [
        `${snapshot.exchangeCode}:${snapshot.symbol}:${snapshot.marketType}`,
        snapshot,
      ]),
    );
    const seen = new Set();
    const analyses = [];
    for (const candidate of data.analyses) {
      const exchangeCode = String(candidate?.exchange || '').toLowerCase();
      const symbol = String(candidate?.symbol || '').trim().toUpperCase();
      const marketType = candidate?.marketType;
      const key = `${exchangeCode}:${symbol}:${marketType}`;
      const snapshot = catalog.get(key);
      if (!snapshot || seen.has(key)) {
        throw new ValidationError('AI proposed a market outside the researched catalog or duplicated a market');
      }
      const strategyKey = String(candidate?.strategyKey || '').trim().toLowerCase();
      if (!allowedStrategies.includes(strategyKey)) {
        throw new ValidationError(`AI proposed an unsupported strategy: ${strategyKey || 'empty'}`);
      }
      const direction = String(candidate?.direction || '').toLowerCase();
      if (!['long', 'short'].includes(direction) || (direction === 'short' && marketType !== 'futures')) {
        throw new ValidationError('AI proposed an unsupported trade direction');
      }
      const confidence = Number(candidate?.confidence);
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        throw new ValidationError('AI returned an invalid confidence value');
      }
      const entry = Number(candidate?.entry);
      const stopLoss = Number(candidate?.stopLoss);
      const targets = Array.isArray(candidate?.targets) ? candidate.targets.map(Number) : [];
      const levelError = validateTradeLevels({ direction, entry, stopLoss, targets });
      if (levelError) throw new ValidationError(`AI trade levels are invalid: ${levelError}`);
      if (Math.abs(entry - snapshot.indicators.price) / snapshot.indicators.price > 0.005) {
        throw new ValidationError('AI entry price is too far from the researched market price');
      }
      const reasoning = String(candidate?.reasoning || '').trim();
      if (reasoning.length < 20) {
        throw new ValidationError('AI analysis reasoning is missing');
      }
      seen.add(key);
      analyses.push({
        exchangeCode,
        instrument: symbol,
        marketType,
        direction,
        strategyKey,
        timeframe,
        entry: String(entry),
        stopLoss: String(stopLoss),
        targets: targets.map(String),
        riskReward: minimumRiskReward(direction, entry, stopLoss, targets),
        confidence,
        marketCondition: String(candidate?.marketCondition || '').slice(0, 64) || null,
        reasoning: reasoning.slice(0, 2000),
        invalidationCondition: String(candidate?.invalidation || '').trim().slice(0, 500) || null,
        indicators: snapshot.indicators,
        dataSources: [snapshot.dataSource],
      });
    }
    if (model) {
      await recordEvent({
        providerId: provider.id,
        eventType: 'research.ai_model',
        message: `AI model used: ${model}`,
        payload: { model },
      });
    }
    return analyses;
  }

  function deterministicCandidates({ provider, snapshots, timeframe }) {
    const analyses = [];
    for (const snapshot of snapshots) {
      const candidate = evaluateStrategy({
        indicators: snapshot.indicators,
        marketType: snapshot.marketType,
        allowedStrategies: provider.allowed_strategies,
      });
      if (!candidate) continue;
      if (candidate.confidence < Number(provider.min_confidence)) continue;
      analyses.push({
        exchangeCode: snapshot.exchangeCode,
        instrument: snapshot.symbol,
        marketType: snapshot.marketType,
        direction: candidate.direction,
        strategyKey: candidate.strategyKey,
        timeframe,
        entry: candidate.entry,
        stopLoss: candidate.stopLoss,
        targets: candidate.targets,
        riskReward: candidate.riskReward,
        confidence: candidate.confidence,
        marketCondition: candidate.marketCondition,
        reasoning: candidate.reasoning,
        invalidationCondition: candidate.invalidationCondition,
        indicators: candidate.indicators,
        dataSources: [snapshot.dataSource],
      });
      if (analyses.length >= provider.max_analyses_per_run) break;
    }
    return analyses.sort((a, b) => b.confidence - a.confidence);
  }

  return { runResearch };
}

function liquidityRank(symbol) {
  const index = LIQUID_SYMBOLS.indexOf(symbol);
  return index === -1 ? 99 : index;
}

function selectAssignment(assignments, candidate) {
  return assignments.find(
    (assignment) =>
      assignment.exchange_code === candidate.exchangeCode &&
      (assignment.allowed_market_types || []).includes(candidate.marketType) &&
      (!Array.isArray(assignment.allowed_symbols) ||
        assignment.allowed_symbols.length === 0 ||
        assignment.allowed_symbols.includes(candidate.instrument)),
  ) || assignments.find((assignment) => assignment.exchange_code === candidate.exchangeCode);
}

function preferredOrderType(assignment, marketType) {
  if (marketType === 'spot') return 'limit';
  return 'market';
}

function minimumRiskReward(direction, entry, stopLoss, targets) {
  const risk = direction === 'long' ? entry - stopLoss : stopLoss - entry;
  if (risk <= 0) return null;
  return Math.min(
    ...targets.map((target) => {
      const reward = direction === 'long' ? target - entry : entry - target;
      return Number((reward / risk).toFixed(6));
    }),
  );
}

export default createOfficialTraderResearchService;
