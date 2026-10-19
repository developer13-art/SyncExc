import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConnectionsService } from '../../src/modules/connections/connections.service.js';

test('rejects an environment unsupported by the selected exchange', async () => {
  const service = createConnectionsService({
    db: {},
    queries: {},
    rateLimiter: {},
    credentialVault: {},
    adapterRegistry: {},
    rateLimitCoordinator: {},
    events: {},
    audit: {},
    logger: {},
  });

  await assert.rejects(
    service.createConnection({
      userId: 'user-id',
      workspaceId: 'workspace-id',
      exchange: 'binance',
      environment: 'demo',
      label: 'Demo account',
      credentials: {},
    }),
    (error) =>
      error.code === 'VALIDATION_ERROR' &&
      error.message === 'Environment demo is not supported for binance',
  );
});
