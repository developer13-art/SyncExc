import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOrderSubmissionService } from '../../src/modules/terminal/order-submission.service.js';

test('normalizes quantity before risk evaluation, persistence, and exchange submission', async () => {
  const submitted = {};
  let storedOrder;
  let riskQuantity;
  let orderId = 0;
  const orderUpdates = [];
  const db = {
    async tx(callback) {
      return callback({});
    },
  };
  const queries = {
    async findExecutionRequestByKey() { return null; },
    async insertExecutionRequest(_tx, payload) {
      return { id: 'execution-1', ...payload };
    },
    async insertOrder(_tx, payload) {
      storedOrder = payload;
      return { id: `order-${++orderId}`, ...payload };
    },
    async insertOrderEvent() {},
    async insertExecutionAttempt() {},
    async updateOrder(_orderId, fields) { orderUpdates.push(fields); },
    async updateExecutionRequest() {},
    async findOrderById(id) { return { id }; },
  };
  const connections = {
    async requireConnectionAccess() {
      return { status: 'active', exchange_code: 'bybit', environment: 'testnet' };
    },
    async requireAccountAccess() {
      return { connection_id: 'connection-1', status: 'active', account_type: 'unified' };
    },
    async getAdapter() {
      return {
        capabilities: { hasSpot: true },
        async placeOrder({ order }) {
          submitted.quantity = order.quantity;
          // Placement responses are acknowledgements, even if the adapter
          // reports a fill; only fetchOrder can confirm a fill.
          return { exchangeOrderId: 'exchange-order-1', status: 'filled' };
        },
        async fetchAccountState() {
          return {
            balances: [
              { asset: 'BTC', free: '2' },
              { asset: 'USDT', free: '1000' },
            ],
          };
        },
      };
    },
    async requireVerifiedPermission() {},
    async loadCredentials() { return {}; },
    async getInstrument() {
      return {
        id: 'instrument-1',
        trading_status: 'active',
        market_type: 'spot',
        base_asset: 'BTC',
        quote_asset: 'USDT',
        quantity_step: '0.01',
        minimum_quantity: '0.01',
      };
    },
  };
  const events = { async publish() {} };
  const service = createOrderSubmissionService({
    db,
    queries,
    connections,
    risk: {
      evaluation: {
        async evaluate({ operationPayload }) {
          riskQuantity = operationPayload.quantity;
          return { outcome: 'allowed', id: 'risk-1', correlationId: 'correlation-1' };
        },
      },
    },
    executionService: {},
    events,
    idempotency: {},
    logger: { warn() {} },
  });

  await service.submit({
    userId: 'user-1',
    workspaceId: 'workspace-1',
    connectionId: 'connection-1',
    accountId: 'account-1',
    marketType: 'spot',
    instrumentId: '0GUSDT',
    side: 'sell',
    type: 'market',
    quantity: '0.123456',
    idempotencyKey: 'quantity-step-test',
  });

  assert.equal(riskQuantity, '0.12');
  assert.equal(storedOrder.quantity, '0.12');
  assert.equal(submitted.quantity, '0.12');
  assert.equal(orderUpdates[0].status, 'submitted');
  assert.equal(orderUpdates[0].averageFillPrice, null);
  assert.equal(storedOrder.clientOrderId, 'execution1');
});

test('rejects Spot market TP/SL before submission when only Spot limit protection is declared', async () => {
  let riskEvaluations = 0;
  let exchangeSubmissions = 0;
  let warning;
  const service = createOrderSubmissionService({
    db: { async tx(callback) { return callback({}); } },
    queries: { async findExecutionRequestByKey() { return null; } },
    connections: {
      async requireConnectionAccess() {
        return { status: 'active', exchange_code: 'bybit', environment: 'testnet' };
      },
      async requireAccountAccess() {
        return { connection_id: 'connection-1', status: 'active', account_type: 'unified' };
      },
      async getAdapter() {
        return {
          capabilities: {
            hasSpot: true,
            bracketProtection: {
              spot: {
                nativePositionOrderTypes: [],
                entryAttachedConditionalOrderTypes: ['limit'],
                postFillConditionalOrderTypes: [],
              },
            },
            supportedOrderTypes: ['market', 'limit'],
          },
          async placeOrder() { exchangeSubmissions += 1; },
        };
      },
      async requireVerifiedPermission() {},
      async loadCredentials() { return {}; },
      async getInstrument() {
        return {
          id: 'instrument-1',
          trading_status: 'active',
          market_type: 'spot',
          quantity_step: '0.01',
          minimum_quantity: '0.01',
        };
      },
    },
    risk: {
      evaluation: {
        async evaluate() {
          riskEvaluations += 1;
          return { outcome: 'allowed', id: 'risk-1' };
        },
      },
    },
    executionService: {},
    events: { async publish() {} },
    idempotency: {},
    logger: { warn(fields) { warning = fields; } },
  });

  await assert.rejects(
    service.submit({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      connectionId: 'connection-1',
      accountId: 'account-1',
      marketType: 'spot',
      instrumentId: 'BTCUSDT',
      side: 'buy',
      type: 'market',
      quantity: '0.01',
      stopLoss: '90',
      takeProfit: '110',
      idempotencyKey: 'spot-market-tpsl-unsupported',
    }),
    (error) => error.code === 'ATTACHED_PROTECTION_UNSUPPORTED' &&
      /No order was submitted/.test(error.message),
  );

  assert.equal(riskEvaluations, 0);
  assert.equal(exchangeSubmissions, 0);
  assert.match(warning.warning, /Post-fill trigger emulation is not enabled/);
});

test('rejects Spot buys with insufficient quote balance before risk checks or dispatch', async () => {
  let riskEvaluations = 0;
  let exchangeSubmissions = 0;
  const service = createOrderSubmissionService({
    db: { async tx(callback) { return callback({}); } },
    queries: { async findExecutionRequestByKey() { return null; } },
    connections: {
      marketData: { async getSpotPrice() { return 100; } },
      async requireConnectionAccess() {
        return { status: 'active', exchange_code: 'bybit', environment: 'testnet' };
      },
      async requireAccountAccess() {
        return { connection_id: 'connection-1', status: 'active', account_type: 'unified' };
      },
      async getAdapter() {
        return {
          capabilities: { hasSpot: true },
          async fetchAccountState() {
            return { balances: [{ asset: 'USDT', free: '5' }] };
          },
          async placeOrder() { exchangeSubmissions += 1; },
        };
      },
      async requireVerifiedPermission() {},
      async loadCredentials() { return {}; },
      async getInstrument() {
        return {
          id: 'instrument-1',
          trading_status: 'active',
          market_type: 'spot',
          base_asset: 'BTC',
          quote_asset: 'USDT',
          quantity_step: '0.01',
          minimum_quantity: '0.01',
        };
      },
    },
    risk: {
      evaluation: {
        async evaluate() {
          riskEvaluations += 1;
          return { outcome: 'allowed', id: 'risk-1' };
        },
      },
    },
    executionService: {},
    events: { async publish() {} },
    idempotency: {},
    logger: { warn() {} },
  });

  await assert.rejects(
    service.submit({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      connectionId: 'connection-1',
      accountId: 'account-1',
      marketType: 'spot',
      instrumentId: 'BTCUSDT',
      side: 'buy',
      type: 'market',
      quantity: '0.1',
      idempotencyKey: 'insufficient-spot-balance',
    }),
    (error) => error.code === 'INSUFFICIENT_BALANCE' &&
      /Insufficient USDT balance/.test(error.message),
  );

  assert.equal(riskEvaluations, 0);
  assert.equal(exchangeSubmissions, 0);
});

test('preflights selected destinations and mirrors only after explicit fill handling', async () => {
  const fixture = createSyncFixture();
  const result = await fixture.service.submit({
    userId: 'user-1',
    workspaceId: 'workspace-1',
    connectionId: 'source-connection',
    accountId: 'source-account',
    marketType: 'spot',
    instrumentId: 'BTCUSDT',
    side: 'buy',
    type: 'limit',
    quantity: '0.2',
    price: '100',
    destinationAccountIds: ['destination-account'],
    idempotencyKey: 'terminal-sync-source-order',
  });

  assert.equal(fixture.sourceSubmissions(), 1);
  assert.equal(fixture.destinationSubmissions(), 0);
  assert.deepEqual(
    result.order.metadata.terminalSync.destinations.map(({ accountId, quantity, status }) => ({
      accountId,
      quantity,
      status,
    })),
    [{
      accountId: 'destination-account',
      quantity: '0.2',
      status: 'waiting_for_source_fill',
    }],
  );

  const pendingResult = await fixture.service.syncFilledOrder({ orderId: result.order.id });
  assert.equal(pendingResult.waitingForSourceFill, true);
  assert.equal(fixture.destinationSubmissions(), 0);

  fixture.orders.get(result.order.id).status = 'filled';
  fixture.orders.get(result.order.id).filled_quantity = '0.2';
  await fixture.service.syncFilledOrder({ orderId: result.order.id });

  assert.equal(
    fixture.destinationSubmissions(),
    1,
    JSON.stringify(fixture.orders.get(result.order.id).metadata.terminalSync),
  );
  const destinationOrder = Array.from(fixture.orders.values()).find(
    (order) => order.source === 'terminal_sync',
  );
  assert.equal(destinationOrder.type, 'market');
  assert.equal(destinationOrder.quantity, '0.2');
  assert.equal(fixture.orders.get(result.order.id).metadata.terminalSync.status, 'completed');
  assert.equal(
    fixture.orders.get(result.order.id).metadata.terminalSync.destinations[0].status,
    'submitted',
  );

  const sourceOrder = fixture.orders.get(result.order.id);
  sourceOrder.metadata.terminalSync.status = 'processing';
  sourceOrder.metadata.terminalSync.destinations[0].status = 'submitting';
  delete sourceOrder.metadata.terminalSync.destinations[0].orderId;
  await fixture.service.syncFilledOrder({ orderId: result.order.id });
  assert.equal(fixture.destinationSubmissions(), 1);
  assert.equal(
    fixture.orders.get(result.order.id).metadata.terminalSync.destinations[0].status,
    'submitted',
  );

  await fixture.service.syncFilledOrder({ orderId: result.order.id });
  assert.equal(fixture.destinationSubmissions(), 1);
});

test('blocks source submission when a selected destination has mismatched market assets', async () => {
  const fixture = createSyncFixture({ destinationQuoteAsset: 'USDC' });

  await assert.rejects(
    fixture.service.submit({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      connectionId: 'source-connection',
      accountId: 'source-account',
      marketType: 'spot',
      instrumentId: 'BTCUSDT',
      side: 'buy',
      type: 'market',
      quantity: '0.2',
      destinationAccountIds: ['destination-account'],
      idempotencyKey: 'terminal-sync-invalid-destination',
    }),
    (error) =>
      error.code === 'SYNC_DESTINATION_PREFLIGHT_FAILED' &&
      /different base or quote assets/.test(error.message),
  );

  assert.equal(fixture.sourceSubmissions(), 0);
  assert.equal(fixture.destinationSubmissions(), 0);
});

function createSyncFixture({ destinationQuoteAsset = 'USDT' } = {}) {
  const orders = new Map();
  const executionRequests = new Map();
  let orderSequence = 0;
  let executionSequence = 0;
  let sourceSubmissionCount = 0;
  let destinationSubmissionCount = 0;
  const db = { async tx(callback) { return callback({}); } };
  const queries = {
    async findExecutionRequestByKey(key) {
      return executionRequests.get(key) || null;
    },
    async insertExecutionRequest(_tx, data) {
      const request = {
        id: `execution-${++executionSequence}`,
        workspace_id: data.workspaceId,
        created_by: data.createdBy,
        ...data,
      };
      executionRequests.set(data.idempotencyKey, request);
      return request;
    },
    async findExecutionRequestById(id) {
      return Array.from(executionRequests.values()).find((request) => request.id === id) || null;
    },
    async updateExecutionRequest(id, fields) {
      const request = Array.from(executionRequests.values()).find((item) => item.id === id);
      Object.assign(request, fields, {
        payload: { ...request.payload, ...(fields.payload || {}) },
      });
    },
    async insertOrder(_tx, data) {
      const order = {
        id: `order-${++orderSequence}`,
        workspace_id: data.workspaceId,
        related_execution_id: data.relatedExecutionId,
        market_type: data.marketType,
        reduce_only: data.reduceOnly,
        filled_quantity: '0',
        ...data,
      };
      orders.set(order.id, order);
      return order;
    },
    async findOrderById(id) {
      return orders.get(id) || null;
    },
    async updateOrder(id, fields) {
      const order = orders.get(id);
      Object.assign(order, fields);
      return order;
    },
    async insertOrderEvent() {},
    async insertExecutionAttempt() {},
  };
  const adapters = {
    bybit: createAdapter('bybit'),
    okx: createAdapter('okx'),
  };
  const connections = {
    marketData: { async getSpotPrice() { return 100; } },
    async requireConnectionAccess({ connectionId }) {
      return {
        id: connectionId,
        status: 'active',
        exchange_code: connectionId === 'source-connection' ? 'bybit' : 'okx',
        environment: 'demo',
      };
    },
    async requireAccountAccess({ accountId }) {
      return {
        connection_id: accountId === 'source-account' ? 'source-connection' : 'destination-connection',
        status: 'active',
        account_type: 'unified',
      };
    },
    async getAdapter(exchangeCode) { return adapters[exchangeCode]; },
    async requireVerifiedPermission() {},
    async loadCredentials() { return {}; },
    async getInstrument({ exchangeCode, marketType }) {
      return {
        id: `${exchangeCode}-BTCUSDT`,
        trading_status: 'active',
        market_type: marketType,
        base_asset: 'BTC',
        quote_asset: exchangeCode === 'okx' ? destinationQuoteAsset : 'USDT',
        quantity_step: '0.01',
        minimum_quantity: '0.01',
        tick_size: '0.01',
      };
    },
  };
  const service = createOrderSubmissionService({
    db,
    queries,
    connections,
    risk: {
      evaluation: {
        async evaluate() { return { outcome: 'allowed', id: 'risk-1' }; },
      },
    },
    executionService: {},
    events: { async publish() {} },
    idempotency: {},
    logger: { warn() {}, error() {} },
  });

  function createAdapter(exchangeCode) {
    return {
      capabilities: { hasSpot: true, supportedOrderTypes: ['market', 'limit'] },
      async fetchAccountState() {
        return {
          balances: [
            { asset: 'BTC', free: '10' },
            { asset: 'USDT', free: '10000' },
            { asset: 'USDC', free: '10000' },
          ],
        };
      },
      async placeOrder() {
        if (exchangeCode === 'bybit') sourceSubmissionCount += 1;
        else destinationSubmissionCount += 1;
        return { exchangeOrderId: `${exchangeCode}-order-${Date.now()}`, status: 'submitted' };
      },
    };
  }

  return {
    service,
    orders,
    sourceSubmissions: () => sourceSubmissionCount,
    destinationSubmissions: () => destinationSubmissionCount,
  };
}
