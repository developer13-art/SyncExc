import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOrderSubmissionService } from '../../src/modules/terminal/order-submission.service.js';

test('normalizes quantity before risk evaluation, persistence, and exchange submission', async () => {
  const submitted = {};
  let storedOrder;
  let riskQuantity;
  let orderId = 0;
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
    async updateOrder() {},
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
          return { exchangeOrderId: 'exchange-order-1', status: 'submitted' };
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
