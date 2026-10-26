import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createExecutionService } from '../../src/modules/terminal/execution.service.js';

function createService(orderOverrides = {}) {
  const updates = [];
  const published = [];
  const order = {
    id: 'local-order-1',
    workspace_id: 'workspace-1',
    instrument: 'BTCUSDT',
    side: 'buy',
    status: 'submitted',
    filled_quantity: '0',
    average_fill_price: null,
    exchange_order_id: 'exchange-order-1',
    client_order_id: 'client-order-1',
    metadata: {},
    ...orderOverrides,
  };
  const service = createExecutionService({
    db: {
      async query() {
        return { rows: [order] };
      },
      async tx(callback) {
        return callback({});
      },
    },
    queries: {
      async updateOrder(orderId, fields) { updates.push({ orderId, fields }); },
      async insertOrderEvent() {},
      async insertFill() { return null; },
    },
    events: {
      async publish(_tx, eventType, payload) { published.push({ eventType, payload }); },
    },
    realtime: null,
    logger: { warn() {}, info() {} },
  });

  return { service, updates, published };
}

test('does not regress a partially filled order on a stale submitted update', async () => {
  const { service, updates } = createService({
    status: 'partially_filled',
    filled_quantity: '0.5',
    average_fill_price: '100',
  });

  const result = await service.handleExecutionUpdate({
    connectionId: 'connection-1',
    update: {
      exchangeOrderId: 'exchange-order-1',
      clientOrderId: 'client-order-1',
      status: 'submitted',
      filledQuantity: '0',
    },
  });

  assert.deepEqual(result, { applied: true });
  assert.equal(updates[0].fields.status, 'partially_filled');
  assert.equal(updates[0].fields.filledQuantity, '0.5');
  assert.equal(updates[0].fields.averageFillPrice, '100');
});

test('resolves uncertain orders by client ID and attaches the confirmed exchange order ID', async () => {
  const { service, updates, published } = createService({
    status: 'reconciliation_required',
    exchange_order_id: null,
  });

  const result = await service.handleExecutionUpdate({
    connectionId: 'connection-1',
    update: {
      exchangeOrderId: 'exchange-order-recovered',
      clientOrderId: 'client-order-1',
      status: 'filled',
      filledQuantity: '1',
      averageFillPrice: '125',
    },
  });

  assert.deepEqual(result, { applied: true });
  assert.equal(updates[0].fields.exchangeOrderId, 'exchange-order-recovered');
  assert.equal(updates[0].fields.status, 'filled');
  const fillEvent = published.find((event) => event.eventType === 'execution.order_filled');
  assert.ok(fillEvent);
  assert.equal(fillEvent.payload.instrument, 'BTCUSDT');
  assert.equal(fillEvent.payload.side, 'buy');
  assert.equal(fillEvent.payload.averageFillPrice, '125');
});

test('does not downgrade a filled order after a stale exchange response', async () => {
  const { service, updates } = createService({
    status: 'filled',
    filled_quantity: '1',
    average_fill_price: '125',
  });

  await service.handleExecutionUpdate({
    connectionId: 'connection-1',
    update: {
      exchangeOrderId: 'exchange-order-1',
      clientOrderId: 'client-order-1',
      status: 'submitted',
      filledQuantity: '0',
    },
  });

  assert.equal(updates[0].fields.status, 'filled');
  assert.equal(updates[0].fields.filledQuantity, '1');
  assert.equal(updates[0].fields.averageFillPrice, '125');
});

test('does not mark an order filled without an exchange fill price', async () => {
  const { service, updates } = createService();
  const result = await service.handleExecutionUpdate({
    connectionId: 'connection-1',
    update: {
      exchangeOrderId: 'exchange-order-1',
      status: 'filled',
      filledQuantity: '1',
      averageFillPrice: null,
    },
  });

  assert.deepEqual(result, { applied: false });
  assert.equal(updates.length, 0);
});

test('publishes a fill event only after confirmed exchange ID, quantity, and price', async () => {
  const { service, updates, published } = createService();
  const result = await service.handleExecutionUpdate({
    connectionId: 'connection-1',
    update: {
      exchangeOrderId: 'exchange-order-1',
      status: 'filled',
      filledQuantity: '1',
      averageFillPrice: '42500.50',
    },
  });

  assert.deepEqual(result, { applied: true });
  assert.equal(updates[0].fields.status, 'filled');
  assert.equal(published.filter((event) => event.eventType === 'execution.order_filled').length, 1);
});

test('derives an exchange-confirmed fill price when the average price is blank', async () => {
  const { service, updates } = createService();
  const result = await service.handleExecutionUpdate({
    connectionId: 'connection-1',
    update: {
      exchangeOrderId: 'exchange-order-1',
      status: 'filled',
      filledQuantity: ' ',
      averageFillPrice: '',
      fills: [
        { quantity: '1', price: '100' },
        { quantity: '1', price: '102' },
      ],
    },
  });

  assert.deepEqual(result, { applied: true });
  assert.equal(updates[0].fields.filledQuantity, '2');
  assert.equal(updates[0].fields.averageFillPrice, '101');
});
