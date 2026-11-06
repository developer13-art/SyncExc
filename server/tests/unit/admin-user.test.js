import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createAdminUserService } from '../../src/modules/admin/admin-user.service.js';

test('admin user search serializes email verification timestamp as camelCase', async () => {
  const verifiedAt = new Date('2026-11-06T14:00:00.000Z');
  const service = createAdminUserService({
    db: {
      async query() {
        return {
          rows: [{
            id: 'user-1',
            email: 'user@example.test',
            email_verified_at: verifiedAt,
            created_at: verifiedAt,
            total_count: '1',
          }],
        };
      },
    },
    queries: {},
    events: {},
    approvals: {},
    audit: { async write() {} },
    logger: {},
  });

  const result = await service.searchUsers({ limit: 10 });

  assert.equal(result.rows[0].emailVerifiedAt, verifiedAt);
  assert.equal(result.rows[0].email_verified_at, undefined);
});

test('admin user detail includes subscription and trading activity without exposing credentials', async () => {
  const user = {
    id: 'user-1',
    email: 'user@example.test',
    username: 'trader',
    display_name: 'Trader User',
    password_hash: 'secret-hash',
    recovery_codes: ['secret-code'],
    mfa_secret_encrypted: 'encrypted-secret',
  };
  const db = {
    async query(sql) {
      if (sql.includes('FROM users') && sql.includes('deleted_at IS NULL')) return { rows: [user] };
      if (sql.includes('FROM user_security_events')) {
        return { rows: [{ event_type: 'login', outcome: 'success', occurred_at: new Date() }] };
      }
      if (sql.includes('FROM users account')) {
        return { rows: [{ mfa_enabled: true, active_session_count: 1, trusted_device_count: 1 }] };
      }
      if (sql.includes('FROM user_sessions')) {
        return { rows: [{ id: 'session-1', last_activity_at: new Date() }] };
      }
      if (sql.includes('FROM workspaces w')) return { rows: [] };
      if (sql.includes('FROM subscriptions subscription')) return { rows: [{ id: 'system-sub', status: 'active' }] };
      if (sql.includes('FROM marketplace_subscriptions subscription')) {
        return { rows: [{ id: 'market-sub', is_subscriber: true, status: 'active' }] };
      }
      if (sql.includes('FROM trading_closed_trades') && sql.includes('COUNT(*)')) {
        return { rows: [{ closed_trade_count: 1, winning_trade_count: 1 }] };
      }
      if (sql.includes('FROM trading_closed_trades')) return { rows: [{ id: 'trade-1', realized_pnl: '10' }] };
      if (sql.includes('FROM trading_orders')) return { rows: [{ id: 'order-1', status: 'filled' }] };
      if (sql.includes('FROM trading_positions')) return { rows: [{ instrument: 'BTCUSDT' }] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const service = createAdminUserService({
    db,
    queries: {},
    events: {},
    approvals: {},
    audit: { async write() {} },
    logger: {},
  });

  const result = await service.getUser({ userId: 'user-1', actorId: 'admin-1' });

  assert.equal(result.user.displayName, 'Trader User');
  assert.equal(result.user.mfaEnabled, true);
  assert.equal(result.user.passwordHash, undefined);
  assert.equal(result.user.recoveryCodes, undefined);
  assert.equal(result.user.mfaSecretEncrypted, undefined);
  assert.equal(result.subscriptions[0].status, 'active');
  assert.equal(result.marketplaceSubscriptions[0].isSubscriber, true);
  assert.equal(result.tradingSummary.closedTradeCount, 1);
  assert.equal(result.recentTrades[0].realizedPnl, '10');
  assert.equal(result.recentOrders[0].status, 'filled');
  assert.equal(result.positions[0].instrument, 'BTCUSDT');
});
