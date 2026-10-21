import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConnectionsModule } from '../../src/modules/connections/index.js';

test('exposes connection access checks to dependent modules', async () => {
  const connection = { id: 'connection-id', workspace_id: 'workspace-id' };
  const middleware = new Proxy({}, {
    get(_target, property) {
      if (property === 'asyncHandler') return (handler) => handler;
      return () => () => {};
    },
  });
  const module = createConnectionsModule({
    services: {
      config: {},
      db: {
        async query() {
          return { rows: [connection], rowCount: 1 };
        },
      },
      middleware,
      rateLimiter: {},
      events: {},
      audit: {},
      realtime: {},
    },
  });

  assert.deepEqual(
    await module.publicApi.requireConnectionAccess({
      connectionId: 'connection-id',
      workspaceId: 'workspace-id',
      operation: 'execute_trades',
    }),
    connection,
  );
  assert.equal(typeof module.publicApi.requireAccountAccess, 'function');
  assert.equal(typeof module.publicApi.requireVerifiedPermission, 'function');
});
