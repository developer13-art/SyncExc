import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConnectionsService } from '../../src/modules/connections/connections.service.js';

test('returns latest balance and margin snapshot data for terminal preflight', async () => {
  const observedAt = new Date();
  const service = createConnectionsService({
    db: {},
    queries: {
      async findAccountById() {
        return { id: 'account-1', connection_id: 'connection-1', status: 'active' };
      },
      async findConnectionById() {
        return {
          id: 'connection-1',
          workspace_id: 'workspace-1',
          status: 'active',
        };
      },
      async getLatestBalanceSnapshot() {
        return { id: 'balance-snapshot-1', observed_at: observedAt, received_at: observedAt };
      },
      async getLatestAccountSnapshot() {
        return {
          observed_at: observedAt,
          equity: '250',
          available_margin: '125',
        };
      },
      async listBalanceItemsForSnapshot() {
        return [{
          asset: 'USDT',
          free: '100',
          used: '25',
          total: '125',
        }];
      },
    },
    rateLimiter: {},
    credentialVault: {},
    adapterRegistry: {},
    rateLimitCoordinator: {},
    events: {},
    audit: {},
    logger: {},
  });

  const result = await service.fetchBalances({
    accountId: 'account-1',
    workspaceId: 'workspace-1',
  });

  assert.equal(result.freshness, 'current');
  assert.equal(result.accountSnapshotFreshness, 'current');
  assert.equal(result.availableMargin, '125');
  assert.equal(result.equity, '250');
  assert.deepEqual(result.items[0], {
    asset: 'USDT',
    free: '100',
    available: '100',
    used: '25',
    reserved: '25',
    total: '125',
    updatedAt: observedAt,
  });
});
