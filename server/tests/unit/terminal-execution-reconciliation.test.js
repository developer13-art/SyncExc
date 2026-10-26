import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createExecutionService } from '../../src/modules/terminal/execution.service.js';

function createService() {
  const updates = [];
  const published = [];
  const service = createExecutionService({
    db: {
      async query() {
        return {
          rows: [{
            id: 'local-order-1',
            workspace_id: 'workspace-1',
            status: 'submitted',
            filled_quantity: '0',
          }],
        };
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
