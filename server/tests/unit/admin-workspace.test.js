import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createAdminWorkspaceService } from '../../src/modules/admin/admin-workspace.service.js';

describe('admin workspace detail', () => {
  it('returns workspace members and writes the audit using the audit service contract', async () => {
    const auditEvents = [];
    const workspace = { id: 'workspace-1', name: 'Trading' };
    const member = {
      id: 'membership-1',
      role: 'owner',
      user_email: 'owner@example.test',
      username: 'owner',
    };
    const db = {
      async query(sql) {
        if (sql.includes('FROM workspaces')) return { rows: [workspace] };
        if (sql.includes('FROM workspace_memberships')) return { rows: [member] };
        if (sql.includes('FROM subscriptions')) return { rows: [] };
        if (sql.includes('FROM connection_sharing_grants')) return { rows: [] };
        throw new Error(`Unexpected query: ${sql}`);
      },
    };
    const service = createAdminWorkspaceService({
      db,
      queries: {},
      events: {},
      audit: {
        async write(event) {
          auditEvents.push(event);
        },
      },
      logger: {},
    });

    const result = await service.getWorkspace({
      workspaceId: workspace.id,
      actorId: 'admin-1',
    });

    assert.equal(result.workspace, workspace);
    assert.deepEqual(result.members, [member]);
    assert.equal(auditEvents[0].resourceType, 'workspace');
    assert.equal(auditEvents[0].resourceId, workspace.id);
    assert.equal(auditEvents[0].targetResource, undefined);
  });

  it('includes trader balances, subscribers, signals and trading activity', async () => {
    const workspace = { id: 'trader-workspace', name: 'Trader', type: 'trader' };
    const provider = { id: 'provider-1', handle: 'trader', display_name: 'Trader Name' };
    const db = {
      async query(sql) {
        if (sql.includes('SELECT * FROM workspaces')) return { rows: [workspace] };
        if (sql.includes('FROM workspace_memberships')) return { rows: [] };
        if (sql.includes('FROM subscriptions')) return { rows: [] };
        if (sql.includes('FROM connection_sharing_grants')) return { rows: [] };
        if (sql.includes('FROM marketplace_provider_profiles')) return { rows: [provider] };
        if (sql.includes('FROM marketplace_trader_earnings')) {
          return { rows: [{ currency: 'USD', available_minor: '1200', platform_fee_minor: '100' }] };
        }
        if (sql.includes('FROM marketplace_subscriptions')) return { rows: [{ status: 'active' }] };
        if (sql.includes('FROM marketplace_published_signals')) {
          return { rows: [{ instrument: 'BTCUSDT', realized_pnl: '10', pnl_asset: 'USDT' }] };
        }
        if (sql.includes('FROM trading_closed_trades') && sql.includes('COUNT(*)')) {
          return { rows: [{ closed_trade_count: 2, winning_trade_count: 1 }] };
        }
        if (sql.includes('FROM trading_closed_trades')) return { rows: [{ instrument: 'BTCUSDT' }] };
        if (sql.includes('FROM trading_orders')) return { rows: [{ status: 'filled', count: 2 }] };
        throw new Error(`Unexpected query: ${sql}`);
      },
    };
    const service = createAdminWorkspaceService({
      db,
      queries: {},
      events: {},
      audit: { async write() {} },
      logger: {},
    });

    const result = await service.getWorkspace({
      workspaceId: workspace.id,
      actorId: 'admin-1',
    });

    assert.equal(result.traderInsights.provider, provider);
    assert.equal(result.traderInsights.balances[0].available_minor, '1200');
    assert.equal(result.traderInsights.subscribers[0].status, 'active');
    assert.equal(result.traderInsights.signalPnlByAsset[0].pnl_asset, 'USDT');
    assert.equal(result.traderInsights.trades[0].instrument, 'BTCUSDT');
    assert.equal(result.traderInsights.orders[0].status, 'filled');
  });
});
