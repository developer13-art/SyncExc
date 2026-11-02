import assert from 'node:assert/strict';
import test from 'node:test';

import { createParserService } from '../../src/modules/signals/parsers.js';
import { createExtractionService } from '../../src/modules/signals/extraction.service.js';
import { createSourceExecutionService } from '../../src/modules/signals/source-execution.service.js';
import {
  analyzeCandles,
  createOfficialTraderService,
} from '../../src/modules/marketplace/official-trader.service.js';
import { createMarketDataService } from '../../src/modules/connections/market-data.service.js';
import { registerAllHandlers } from '../../src/jobs/handlers.js';
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
      query: async (sql) => sql.includes('UPDATE trading_execution_destination_results')
        ? { rows: [{ id: 'destination-result-id' }] }
        : { rows: [{ id: 'source-id', workspace_id: 'workspace-id', created_by: 'user-id' }] },
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

test('official market analysis emits long signals only for supported spot direction', () => {
  const candles = Array.from({ length: 80 }, (_, index) => {
    const close = 100 + index * 0.1 + Math.sin(index * 0.4);
    return {
      open: close - 0.02,
      high: close + 0.05,
      low: close - 0.05,
      close,
    };
  });

  const result = analyzeCandles(candles, 'spot');
  assert.equal(result.direction, 'long');
  assert.ok(Number(result.stopLoss) < Number(result.price));
  assert.ok(Number(result.takeProfit) > Number(result.price));
  assert.equal(analyzeCandles(candles.slice(0, 20), 'spot'), null);
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

test('official trader publishes AI-reviewed market signals through marketplace publication', async () => {
  const candles = Array.from({ length: 80 }, (_, index) => {
    const close = 100 + index * 0.1 + Math.sin(index * 0.4);
    return { open: close - 0.02, high: close + 0.05, low: close - 0.05, close };
  });
  const publishedSignals = [];
  const db = {
    query: async (sql) => {
      if (sql.includes('FROM marketplace_provider_profiles')) {
        return { rows: [{ id: 'provider-id', user_id: 'bot-user', workspace_id: 'bot-workspace' }] };
      }
      if (sql.includes('FROM exchange_instruments')) {
        return {
          rows: [{
            exchange_code: 'binance',
            exchange_symbol: 'BTCUSDT',
            normalized_symbol: 'BTCUSDT',
            market_type: 'spot',
          }],
        };
      }
      return { rows: [] };
    },
  };
  const scanner = createOfficialTraderService({
    db,
    marketData: { getCandles: async () => ({ candles }) },
    ai: {
      chatJson: async () => ({
        data: { publish: true, confidence: 0.9, summary: 'Trend and momentum are aligned.' },
      }),
    },
    publication: {
      publishSignal: async (signal) => publishedSignals.push(signal),
    },
    logger: { info() {}, warn() {}, error() {} },
  });

  const result = await scanner.scanNow();
  assert.equal(result.instrumentsScanned, 1);
  assert.equal(result.published, 1);
  assert.equal(publishedSignals[0].providerId, 'provider-id');
  assert.equal(publishedSignals[0].instrument, 'BTCUSDT');
  assert.equal(publishedSignals[0].orderType, 'market');
  assert.equal(publishedSignals[0].targets.length, 1);
});

test('registers the official trader scan as an independently scheduled job handler', async () => {
  const handlers = new Map();
  await registerAllHandlers({
    registry: {
      register: (type, handler) => handlers.set(type, handler),
      list: () => [...handlers.keys()],
    },
    services: {},
  });
  let scanned = false;
  await handlers.get('marketplace_official_trader_scan')({
    services: { marketplace: { officialTrader: { scanNow: async () => { scanned = true; } } } },
  });
  assert.equal(scanned, true);
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
      query: async (sql) => sql.includes('FROM trading_execution_intents')
        ? { rows: [] }
        : {
          rows: [{
            id: 'source-id',
            workspace_id: 'workspace-id',
            created_by: 'user-id',
            status: 'active',
            monitoring_enabled: true,
          }],
        },
    },
    logger: { debug() {}, error() {} },
  });

  await onMessageReceived({ payload: { messageId: 'message-id' } });
  assert.deepEqual(calls, ['issues', 'validation', 'eligibility', 'intent', 'execution']);
});
