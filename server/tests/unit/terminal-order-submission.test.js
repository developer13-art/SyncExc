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
