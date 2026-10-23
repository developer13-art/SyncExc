import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConnectionsService } from '../../src/modules/connections/connections.service.js';

test('returns current adapter capabilities for existing connections', async () => {
  const liveCapabilities = {
    hasSpot: true,
    hasAttachedBracketProtectionMarkets: ['spot', 'futures'],
    hasAttachedBracketProtectionOrderTypes: { spot: ['limit'] },
    protectedMarketOrderFallbacks: {
      spot: {
        orderType: 'limit',
        timeInForce: 'IOC',
        maxSlippageBps: 50,
        directions: ['long'],
      },
    },
  };
  const service = createConnectionsService({
    db: {},
    queries: {
      async listConnectionsForWorkspace() {
        return [{
          id: 'connection-1',
          exchange_code: 'bybit',
          status: 'active',
          capabilities: { hasSpot: true },
        }];
      },
      async listAccountsForConnection() {
        return [{ id: 'account-1', status: 'active' }];
      },
      async getHealth() { return null; },
      async findExchangeByCode() { return { display_name: 'Bybit' }; },
    },
    rateLimiter: {},
    credentialVault: {},
    adapterRegistry: { get: () => ({ capabilities: liveCapabilities }) },
    rateLimitCoordinator: {},
    events: {},
    audit: {},
    logger: {},
  });

  const connections = await service.listConnections({
    userId: 'user-1',
    workspaceId: 'workspace-1',
  });

  assert.deepEqual(connections[0].capabilities, liveCapabilities);
});
