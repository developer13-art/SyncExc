import assert from 'node:assert/strict';
import test from 'node:test';

import { createDashboardService } from '../../src/modules/admin/dashboard.service.js';

test('dashboard exposes real growth series and recent signups', async () => {
  const since = new Date('2026-10-15T00:00:00.000Z');
  const service = createDashboardService({
    db: {},
    logger: {},
    queries: {
      countUsers: async () => 8,
      countAllUsers: async () => 120,
      countActiveWorkspaces: async () => 30,
      countActiveExchanges: async () => 6,
      platformGrowth: async () => [{
        day: since,
        new_users: 3,
        new_workspaces: 2,
        successful_payments: 4,
      }],
      recentSignups: async () => [{
        id: 'user-1',
        display_name: 'Test User',
        username: 'test_user',
        avatar_url: null,
        status: 'active',
        created_at: since,
      }],
      tradingVolume24h: async () => ({ volume: '5000', previous_volume: '4000' }),
      exchangeOverview: async () => [{
        exchange_code: 'bybit',
        display_name: 'Bybit',
        connection_count: 3,
        healthy_count: 2,
        current_balance: '1000',
        prior_balance: '800',
      }],
      recentPlatformActivity: async () => [],
      topPerformingTraders: async () => [],
      recentSignals: async () => [],
      countActiveSubscriptions: async () => 12,
      subscriptionsByStatus: async () => [{ status: 'active', count: 12 }],
      paymentMetrics: async () => ({
        successful: 4,
        failed: 1,
        pending: 0,
        total_volume_minor: '1000',
      }),
      unresolvedRefunds: async () => 0,
      exchangeHealthSummary: async () => [{ state: 'healthy', count: 6 }],
      syncBacklog: async () => ({
        queued: 0,
        processing: 0,
        reconciliation_required: 0,
      }),
      sourceReviewBacklog: async () => 0,
      riskAlertsOpen: async () => 0,
      supportBacklog: async () => ({ open: 0, urgent: 0 }),
      auditFailuresCount: async () => 0,
    },
  });

  const dashboard = await service.getOverview({ timeRange: '7d' });

  assert.equal(dashboard.totalUsers, 120);
  assert.equal(dashboard.activeWorkspaces, 30);
  assert.equal(dashboard.activeExchanges, 6);
  assert.deepEqual(dashboard.tradingVolume24h, { volume: '5000', changePct: 25 });
  assert.deepEqual(dashboard.exchangeOverview[0], {
    exchangeCode: 'bybit',
    displayName: 'Bybit',
    connectionCount: 3,
    healthyCount: 2,
    stablecoinBalanceUsd: 1000,
    stablecoinBalanceChangePct: 25,
  });
  assert.deepEqual(dashboard.platformGrowth[0], {
    date: since,
    newUsers: 3,
    newWorkspaces: 2,
    successfulPayments: 4,
  });
  assert.equal(dashboard.recentSignups[0].displayName, 'Test User');
});
