import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTerminalController } from '../../src/modules/terminal/terminal.controller.js';
import { createTerminalQueries } from '../../src/modules/terminal/terminal.queries.js';
import { createTerminalService } from '../../src/modules/terminal/terminal.service.js';

function createResponse() {
  return {
    req: { headers: {} },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('closes a long position with a reduce-only market sell on its stored exchange account', async () => {
  let submittedOrder;
  const controller = createTerminalController({
    service: {
      async getOpenPositionForClose(request) {
        assert.deepEqual(request, {
          workspaceId: 'workspace-1',
          positionId: 'position-1',
        });
        return {
          id: 'position-1',
          workspace_id: 'workspace-1',
          connection_id: 'connection-1',
          account_id: 'account-1',
          instrument: 'BTCUSDT',
          side: 'long',
          quantity: '0.25',
          updated_at: new Date('2026-11-03T10:00:00.000Z'),
        };
      },
    },
    orderSubmissionService: {
      async submit(order) {
        submittedOrder = order;
        return { order: { id: 'close-order-1', status: 'submitted' } };
      },
    },
  });
  const response = createResponse();

  await controller.closePosition({
    auth: { userId: 'user-1' },
    workspace: { id: 'workspace-1' },
    params: { positionId: 'position-1' },
  }, response);

  assert.equal(submittedOrder.userId, 'user-1');
  assert.equal(submittedOrder.connectionId, 'connection-1');
  assert.equal(submittedOrder.accountId, 'account-1');
  assert.equal(submittedOrder.marketType, 'futures');
  assert.equal(submittedOrder.instrumentId, 'BTCUSDT');
  assert.equal(submittedOrder.side, 'sell');
  assert.equal(submittedOrder.type, 'market');
  assert.equal(submittedOrder.quantity, '0.25');
  assert.equal(submittedOrder.reduceOnly, true);
  assert.match(submittedOrder.idempotencyKey, /^close-position:[a-f0-9]{64}$/);
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.order.id, 'close-order-1');
});

test('returns a separate workspace approval request for a risk-gated close', async () => {
  const controller = createTerminalController({
    service: {
      async getOpenPositionForClose() {
        return {
          id: 'position-1',
          workspace_id: 'workspace-1',
          connection_id: 'connection-1',
          account_id: 'account-1',
          instrument: 'BTCUSDT',
          side: 'short',
          quantity: '0.25',
          updated_at: new Date('2026-11-03T10:00:00.000Z'),
        };
      },
    },
    orderSubmissionService: {
      async submit() {
        return {
          requiresConfirmation: true,
          executionRequest: { id: 'approval-1' },
          riskDecision: { reasonCode: 'workspace_policy' },
        };
      },
    },
  });
  const response = createResponse();

  await controller.closePosition({
    auth: { userId: 'user-1' },
    workspace: { id: 'workspace-1' },
    params: { positionId: 'position-1' },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body.data, {
    requiresConfirmation: true,
    executionRequestId: 'approval-1',
    riskDecision: { reasonCode: 'workspace_policy' },
  });
});

test('loads a closeable position only within the active workspace and only when quantity is positive', async () => {
  let query;
  let params;
  const queries = createTerminalQueries({
    db: {
      async query(sql, values) {
        query = sql;
        params = values;
        return { rows: [] };
      },
    },
  });

  await queries.findOpenPositionForClose('workspace-1', 'position-1');

  assert.match(query, /workspace_id = \$1 AND id = \$2 AND quantity > 0/);
  assert.deepEqual(params, ['workspace-1', 'position-1']);
});

test('rejects a position that is not a long or short open futures position', async () => {
  const service = createTerminalService({
    db: {},
    queries: {
      async findOpenPositionForClose() {
        return { id: 'position-1', side: 'net' };
      },
    },
  });

  await assert.rejects(
    service.getOpenPositionForClose({
      workspaceId: 'workspace-1',
      positionId: 'position-1',
    }),
    { code: 'NOT_FOUND' },
  );
});
