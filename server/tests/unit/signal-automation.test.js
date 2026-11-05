import assert from 'node:assert/strict';
import test from 'node:test';

import { createParserService } from '../../src/modules/signals/parsers.js';
import { createExtractionService } from '../../src/modules/signals/extraction.service.js';
import { createSourceExecutionService } from '../../src/modules/signals/source-execution.service.js';
import {
  computeIndicators,
  evaluateStrategy,
} from '../../src/modules/official-trader/official-trader.strategy.js';
import { createOfficialTraderResearchService } from '../../src/modules/official-trader/official-trader.research.service.js';
import { createMarketDataService } from '../../src/modules/connections/market-data.service.js';
import { registerAllHandlers } from '../../src/jobs/handlers.js';
import { registerAllSchedules } from '../../src/jobs/schedules.js';
import { createSignalsListeners } from '../../src/modules/signals/listeners.js';

test('parses market type, order type, entry, stop, and targets from a signal', async () => {
  const parser = createParserService({
    db: {},
    queries: {
      findMessageById: async () => ({
        content: 'BTC/USDT Long Futures Limit Entry range 60000-60200 SL 59000 TP1 61000',
      }),
    },
    logger: { warn() {} },
  });

  const result = await parser.parseMessage('message-id');
  assert.equal(result.result.instrument, 'BTC/USDT');
  assert.equal(result.result.marketType, 'futures');
  assert.equal(result.result.orderType, 'limit');
  assert.deepEqual(result.result.entryRange, { min: '60000', max: '60200' });
  assert.equal(result.result.stopLoss, '59000');
  assert.deepEqual(result.result.targets, ['61000']);
});

test('persists an incomplete AI-detected signal without null provenance fields', async () => {
  let insertedCandidate;
  const signalFields = [];
  const issues = [];
  const queries = {
    findMessageById: async () => ({ id: 'message-id', source_id: 'source-id', content: 'Possible setup' }),
    findCandidateByMessageId: async () => null,
    insertCandidate: async (_tx, candidate) => {
      insertedCandidate = candidate;
      return { id: 'candidate-id', ...candidate };
    },
    insertSignalField: async (_tx, field) => signalFields.push(field),
    insertIssue: async (_tx, issue) => issues.push(issue),
    insertCandidateVersion: async () => {},
    insertProcessingJob: async () => {},
    updateMessageStatus: async () => {},
  };
  const extraction = createExtractionService({
    db: {
      query: async () => ({ rows: [{}] }),
      tx: async (callback) => callback({}),
    },
    queries,
    parser: { parseMessage: async () => null },
    aiInterpreter: {
      interpret: async () => ({ result: { isSignal: true, confidence: 0.6 } }),
    },
    logger: { warn() {} },
  });

  const result = await extraction.extractFromMessage({ messageId: 'message-id' });
  assert.equal(result.isSignal, true);
  assert.equal(insertedCandidate.instrument, null);
  assert.equal(insertedCandidate.direction, null);
  assert.deepEqual(signalFields, []);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, 'high');
});

test('keeps ambiguous signal updates blocked even when AI classifies them as signals', async () => {
  const issues = [];
  let aiCalls = 0;
  const queries = {
    findMessageById: async () => ({
      id: 'message-id',
      source_id: 'source-id',
      content: 'Close position: BTC/USDT Long Futures Entry 100 SL 90 TP 120',
    }),
    findCandidateByMessageId: async () => null,
    insertCandidate: async (_tx, candidate) => ({ id: 'candidate-id', ...candidate }),
    insertSignalField: async () => {},
    insertSignalTarget: async () => {},
    insertIssue: async (_tx, issue) => issues.push(issue),
    insertCandidateVersion: async () => {},
    insertProcessingJob: async () => {},
    updateMessageStatus: async () => {},
  };
  const extraction = createExtractionService({
    db: {
      query: async () => ({ rows: [{}] }),
      tx: async (callback) => callback({}),
    },
    queries,
    parser: {
      parseMessage: async () => ({
        result: {
          instrument: 'BTC/USDT',
          marketType: 'futures',
          direction: 'long',
          orderType: 'market',
          entry: '100',
          stopLoss: '90',
          targets: ['120'],
        },
      }),
    },
    aiInterpreter: {
      interpret: async () => {
        aiCalls += 1;
        return { result: { isSignal: true, confidence: 0.9 } };
      },
    },
    logger: { warn() {} },
  });

  const result = await extraction.extractFromMessage({ messageId: 'message-id' });
  assert.equal(result.isSignal, true);
  assert.equal(aiCalls, 1);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, 'high');
});

test('does not execute live-mode sources without explicit authorized automation', async () => {
  let submittedOrders = 0;
  let updatedIntentStatus;
  const sourceExecution = createSourceExecutionService({
    db: {
      query: async () => ({ rows: [{ id: 'source-id', workspace_id: 'workspace-id', created_by: 'user-id' }] }),
    },
    queries: {
      findExecutionIntentById: async () => ({
        id: 'intent-id',
        signal_id: 'candidate-id',
        workspace_id: 'workspace-id',
        status: 'created',
        payload: { executionMode: 'authorized_automation' },
      }),
      findCandidateById: async () => ({ id: 'candidate-id', source_id: 'source-id' }),
      findLatestValidation: async () => ({ outcome: 'passed' }),
      updateExecutionIntentStatus: async (_id, status) => { updatedIntentStatus = status; },
    },
    sources: {
      registry: { getExecutionConfig: async () => ({ mode: 'live', settings: {} }) },
    },
    connections: {},
    terminal: { submitOrder: async () => { submittedOrders += 1; } },
    logger: { error() {} },
  });

  const result = await sourceExecution.executeIntent({ intentId: 'intent-id' });
  assert.equal(result.held, true);
  assert.equal(updatedIntentStatus, 'held');
  assert.equal(submittedOrders, 0);
});

test('holds market signals when market orders are disabled in source settings', async () => {
  let submittedOrders = 0;
  const sourceExecution = createSourceExecutionService({
    db: {
      query: async () => ({ rows: [{ id: 'source-id', workspace_id: 'workspace-id', created_by: 'user-id' }] }),
    },
    queries: {
      findExecutionIntentById: async () => ({
        id: 'intent-id',
        signal_id: 'candidate-id',
        workspace_id: 'workspace-id',
        status: 'created',
        payload: { executionMode: 'authorized_automation' },
      }),
      findCandidateById: async () => ({
        id: 'candidate-id',
        source_id: 'source-id',
        market_type: 'spot',
        direction: 'long',
        order_type: 'market',
        entry: '100',
        stop_loss: '90',
      }),
      findLatestValidation: async () => ({ outcome: 'passed' }),
      updateExecutionIntentStatus: async () => {},
    },
    sources: {
      registry: {
        getExecutionConfig: async () => ({
          mode: 'authorized_automation',
          settings: { allowMarketOrders: false },
        }),
      },
    },
    connections: {},
    terminal: { submitOrder: async () => { submittedOrders += 1; } },
    logger: { error() {} },
  });

  const result = await sourceExecution.executeIntent({ intentId: 'intent-id' });
  assert.equal(result.held, true);
  assert.equal(result.reason, 'Market orders are disabled for this source');
  assert.equal(submittedOrders, 0);
});

test('routes authorized source orders through terminal risk checks', async () => {
  let submittedOrder;
  let updatedIntentStatus;
  const sourceExecution = createSourceExecutionService({
    db: {
      query: async (sql) => {
        if (sql.includes('FROM signal_sources')) {
          assert.match(sql, /owner_id AS created_by/);
          return { rows: [{ id: 'source-id', workspace_id: 'workspace-id', created_by: 'user-id' }] };
        }
        if (sql.includes('UPDATE trading_execution_destination_results')) {
          return { rows: [{ id: 'destination-result-id' }] };
        }
        return { rows: [] };
      },
    },
    queries: {
      findExecutionIntentById: async () => ({
        id: 'intent-id',
        signal_id: 'candidate-id',
        workspace_id: 'workspace-id',
        status: 'created',
        payload: { executionMode: 'authorized_automation' },
      }),
      findCandidateById: async () => ({
        id: 'candidate-id',
        source_id: 'source-id',
        instrument: 'BTCUSDT',
        market_type: 'spot',
        direction: 'long',
        order_type: 'market',
        entry: '100',
        stop_loss: '90',
        entry_range: null,
      }),
      findLatestValidation: async () => ({ outcome: 'passed' }),
      listExecutionDestinationResults: async () => [{
        id: 'destination-result-id',
        account_id: 'account-id',
        idempotency_key: 'destination-key',
        status: 'pending',
      }],
      listTargetsForCandidate: async () => [{ value: '120' }],
      updateExecutionIntentStatus: async (_id, status) => { updatedIntentStatus = status; },
    },
    sources: {
      registry: {
        getExecutionConfig: async () => ({
          mode: 'authorized_automation',
          settings: { riskPerTradePct: 1, maxLeverage: 3, maxNotional: 25 },
        }),
      },
    },
    connections: {
      requireAccountAccess: async () => ({
        id: 'account-id',
        connection_id: 'connection-id',
        account_type: 'unified',
        status: 'active',
      }),
      getConnection: async () => ({
        id: 'connection-id',
        status: 'active',
        environment: 'live',
        exchange_code: 'binance',
      }),
      getInstrument: async () => ({
        exchange_symbol: 'BTCUSDT',
        trading_status: 'active',
        quote_asset: 'USDT',
      }),
      marketData: { getSpotPrice: async () => 100 },
      getAdapter: async () => ({
        fetchAccountState: async () => ({
          balances: [{ asset: 'USDT', free: '1000' }],
        }),
      }),
      loadCredentials: async () => ({ apiKey: 'key', apiSecret: 'secret' }),
    },
    terminal: {
      submitOrder: async (params, options) => {
        submittedOrder = { params, options };
        return { order: { id: 'order-id', status: 'submitted' } };
      },
    },
    logger: { error() {} },
  });

  const result = await sourceExecution.executeIntent({ intentId: 'intent-id' });
  assert.equal(result.status, 'dispatched');
  assert.equal(updatedIntentStatus, 'dispatched');
  assert.equal(submittedOrder.options.source, 'signal_automation');
  assert.equal(submittedOrder.params.idempotencyKey, 'destination-key');
  assert.equal(Number(submittedOrder.params.quantity), 0.25);
});

test('official deterministic strategy validates real candle levels', () => {
  const candles = Array.from({ length: 80 }, (_, index) => {
    const close = 100 + index * 0.1 + (index % 2 === 0 ? -0.4 : 0.4);
    return {
      open: close - 0.02,
      high: close + 0.08,
      low: close - 0.08,
      close,
      volume: 1000,
      timestamp: 1700000000000 + index * 3600000,
    };
  });

  const indicators = computeIndicators(candles);
  assert.ok(indicators);
  const result = evaluateStrategy({
    indicators,
    marketType: 'spot',
    allowedStrategies: ['trend_following', 'breakout', 'momentum'],
  });
  assert.ok(result);
  assert.equal(result.direction, 'long');
  assert.ok(Number(result.stopLoss) < Number(result.entry));
  assert.ok(Number(result.targets[0]) > Number(result.entry));
  assert.equal(result.riskReward, 2);
  assert.equal(computeIndicators(candles.slice(0, 20)), null);
});

test('candle-only market data uses one exchange request', async () => {
  const requests = [];
  const service = createMarketDataService({
    logger: { warn() {} },
    fetchImpl: async (url) => {
      requests.push(String(url));
      return {
        ok: true,
        json: async () => [[1700000000000, '1', '2', '0.5', '1.5', '10']],
      };
    },
  });

  const result = await service.getCandles({
    exchangeCode: 'binance',
    symbol: 'BTCUSDT',
    marketType: 'spot',
    timeframe: '15m',
    limit: 25,
  });
  assert.equal(result.candles[0].close, 1.5);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /interval=15m/);
});

test('market data pauses an exchange after 418 and honors Retry-After', async () => {
  let currentTime = 1_000_000;
  let requests = 0;
  const service = createMarketDataService({
    now: () => currentTime,
    fetchImpl: async () => {
      requests += 1;
      if (requests === 1) {
        return new Response('IP banned', {
          status: 418,
          headers: { 'Retry-After': '2' },
        });
      }
      return new Response(JSON.stringify([
        [currentTime, '1', '2', '0.5', '1.5', '10'],
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  const query = {
    exchangeCode: 'binance',
    symbol: 'BTCUSDT',
    marketType: 'spot',
    timeframe: '15m',
    limit: 25,
  };

  await assert.rejects(service.getCandles(query), (error) => {
    assert.equal(error.code, 'MARKET_DATA_RATE_LIMITED');
    assert.equal(error.details.status, 418);
    assert.equal(error.details.retryAfterMs, 2_000);
    return true;
  });
  await assert.rejects(service.getCandles(query), { code: 'MARKET_DATA_RATE_LIMITED' });
  assert.equal(requests, 1);

  currentTime += 2_001;
  const result = await service.getCandles(query);
  assert.equal(result.candles[0].close, 1.5);
  assert.equal(requests, 2);
});

test('official research stops before AI when execution settings are disabled', async () => {
  let aiCalls = 0;
  const research = createOfficialTraderResearchService({
    db: { query: async () => ({ rows: [] }) },
    queries: { listConnections: async () => [] },
    connections: { marketData: { getCandles: async () => ({ candles: [] }) } },
    ai: { chatJson: async () => { aiCalls += 1; return { data: {} }; } },
    logger: { info() {}, warn() {}, error() {} },
    getProvider: async () => ({
      id: 'provider-id',
      workspace_id: 'workspace-id',
      settings_status: 'paused',
      research_enabled: true,
    }),
    recordEvent: async () => {},
  });

  const result = await research.runResearch({ trigger: 'test' });
  assert.deepEqual(result, { skipped: true, reason: 'Official trader is paused' });
  assert.equal(aiCalls, 0);
});

test('official trader schedules research and five-minute reconciliation', async () => {
  const schedules = [];
  await registerAllSchedules({
    scheduler: {
      add(schedule) {
        schedules.push(schedule);
      },
      list() {
        return schedules;
      },
    },
  });

  const research = schedules.find((schedule) => schedule.name === 'official-trader-research');
  const reconcile = schedules.find((schedule) => schedule.name === 'official-trader-reconcile');
  assert.equal(research.runOnce, true);
  assert.equal(research.intervalMs, 15 * 60 * 1000);
  assert.equal(reconcile.runOnce, true);
  assert.equal(reconcile.intervalMs, 5 * 60 * 1000);
});

test('registers official trader research and reconciliation job handlers', async () => {
  const handlers = new Map();
  await registerAllHandlers({
    registry: {
      register: (type, handler) => handlers.set(type, handler),
      list: () => [...handlers.keys()],
    },
    services: {},
  });
  let researched = false;
  let reconciled = false;
  const services = {
    officialTrader: {
      runResearch: async () => { researched = true; },
      reconcileNow: async () => { reconciled = true; },
    },
  };
  await handlers.get('official_trader_research')({ services });
  await handlers.get('official_trader_reconcile')({ services });
  assert.equal(researched, true);
  assert.equal(reconciled, true);
});

test('chains received messages through validation, eligibility, and authorized execution', async () => {
  const calls = [];
  let onMessageReceived;
  createSignalsListeners({
    events: {
      subscribe: (eventType, handler) => {
        if (eventType === 'signal.message_received') onMessageReceived = handler;
      },
    },
    ingestion: {},
    extraction: {
      extractFromMessage: async () => ({
        isSignal: true,
        candidate: { id: 'candidate-id', source_id: 'source-id' },
      }),
    },
    issueDetection: { detectIssues: async () => calls.push('issues') },
    validation: { validateCandidate: async () => calls.push('validation') },
    eligibility: {
      decideEligibility: async () => {
        calls.push('eligibility');
        return { outcome: 'eligible_for_handoff' };
      },
    },
    intentHandoff: {
      createIntent: async () => {
        calls.push('intent');
        return { id: 'intent-id' };
      },
    },
    sourceExecution: { executeIntent: async () => calls.push('execution') },
    sources: {
      registry: {
        getExecutionConfig: async () => ({ mode: 'authorized_automation' }),
      },
    },
    db: {
      query: async (sql) => {
        if (sql.includes('FROM trading_execution_intents')) return { rows: [] };
        assert.match(sql, /owner_id AS created_by/);
        return {
          rows: [{
            id: 'source-id',
            workspace_id: 'workspace-id',
            created_by: 'user-id',
            status: 'active',
            monitoring_enabled: true,
          }],
        };
      },
    },
    logger: { debug() {}, error() {} },
  });

  await onMessageReceived({ payload: { messageId: 'message-id' } });
  assert.deepEqual(calls, ['issues', 'validation', 'eligibility', 'intent', 'execution']);
});
