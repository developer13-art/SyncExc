/**
 * SyncExc Server — Admin user service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createAdminUserService({ db, queries, events, approvals, audit, logger }) {
  async function searchUsers({ query, status, limit = 50, cursor = null, offset } = {}) {
    const params = [limit + 1];
    const conditions = ['deleted_at IS NULL'];
    if (query) {
      params.push(`%${query}%`);
      conditions.push(`(email ILIKE $${params.length} OR username ILIKE $${params.length} OR display_name ILIKE $${params.length})`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (cursor) {
      params.push(cursor);
      conditions.push(`created_at < $${params.length}`);
    }

    const result = await db.query(
      `
      SELECT id, email, username, display_name, status, email_verified_at, created_at, updated_at
        , COUNT(*) OVER () AS total_count
      FROM users
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $1
      ${offset === undefined ? '' : `OFFSET $${params.push(offset)}`}
      `,
      params
    );

    const hasMore = result.rows.length > limit;
    const selectedRows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const total = Number(selectedRows[0]?.total_count ?? 0);
    const rows = selectedRows.map(({ total_count: _totalCount, ...row }) => camelizeRow(row));
    const last = selectedRows[selectedRows.length - 1];
    return {
      rows,
      nextCursor: hasMore && last ? last.created_at.toISOString() : null,
      total,
    };
  }

  async function getUser({ userId, actorId }) {
    const userResult = await db.query(
      `
      SELECT id, email, email_verified_at, username, display_name, avatar_url,
             preferred_language, timezone, country_code, status, terms_version,
             terms_accepted_at, privacy_version, privacy_accepted_at, created_at, updated_at
      FROM users
      WHERE id = $1 AND deleted_at IS NULL
      `,
      [userId]
    );
    const user = userResult.rows[0];
    if (!user) throw new NotFoundError('User');

    const [events, sessions, workspaces, subscriptions, marketplaceSubscriptions, tradingSummary, recentTrades, recentOrders, positions, securitySummary] = await Promise.all([
      db.query(
        `SELECT * FROM user_security_events WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT 20`,
        [userId],
      ),
      db.query(
        `
        SELECT id, device_label, ip_address, created_at, last_activity_at, expires_at, revoked_at
        FROM user_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20
        `,
        [userId],
      ),
      db.query(
        `
        SELECT w.id, w.name, w.type, w.status, m.role, m.created_at AS joined_at,
               (w.owner_id = $1) AS is_owner
        FROM workspaces w
        JOIN workspace_memberships m ON m.workspace_id = w.id
        WHERE m.user_id = $1 AND m.status = 'active'
        `,
        [userId],
      ),
      db.query(
        `
        SELECT subscription.id, subscription.status, subscription.current_period_start,
               subscription.current_period_end, subscription.next_billing_at,
               subscription.cancel_at_period_end, subscription.canceled_at,
               subscription.created_at, plan.name AS plan_name,
               price.currency, price.amount_minor, price.billing_interval
        FROM subscriptions subscription
        JOIN subscription_plan_versions version ON version.id = subscription.plan_version_id
        JOIN subscription_plans plan ON plan.id = version.plan_id
        JOIN subscription_plan_prices price ON price.id = subscription.plan_price_id
        WHERE subscription.billing_scope_type = 'user' AND subscription.billing_scope_id = $1
        ORDER BY subscription.created_at DESC
        `,
        [userId],
      ),
      db.query(
        `
        SELECT subscription.id, subscription.status, subscription.created_at,
               subscription.current_period_end, subscription.subscriber_user_id,
               subscriber.email AS subscriber_email,
               provider.id AS provider_id, provider.display_name AS provider_name,
               provider.handle AS provider_handle, owner.email AS trader_email,
               plan.name AS plan_name,
               COALESCE(SUM(earning.gross_amount_minor), 0)::bigint AS gross_paid_minor,
               COALESCE(SUM(earning.trader_net_amount_minor), 0)::bigint AS trader_net_minor,
               COALESCE(MAX(earning.currency), plan.pricing->>'currency') AS currency,
               (subscription.subscriber_user_id = $1) AS is_subscriber
        FROM marketplace_subscriptions subscription
        JOIN marketplace_provider_profiles provider ON provider.id = subscription.provider_id
        JOIN workspaces workspace ON workspace.id = provider.workspace_id
        JOIN users owner ON owner.id = workspace.owner_id
        JOIN users subscriber ON subscriber.id = subscription.subscriber_user_id
        LEFT JOIN marketplace_provider_plans plan ON plan.id = subscription.plan_id
        LEFT JOIN marketplace_trader_earnings earning
          ON earning.subscription_id = subscription.id AND earning.status <> 'reversed'
        WHERE subscription.subscriber_user_id = $1
           OR provider.user_id = $1
           OR workspace.owner_id = $1
        GROUP BY subscription.id, subscriber.email, provider.id, provider.display_name,
                 provider.handle, owner.email, plan.name, plan.pricing
        ORDER BY subscription.created_at DESC
        LIMIT 100
        `,
        [userId],
      ),
      db.query(
        `
        SELECT COUNT(*)::int AS closed_trade_count,
               COUNT(*) FILTER (WHERE realized_pnl > 0)::int AS winning_trade_count,
               COUNT(*) FILTER (WHERE realized_pnl < 0)::int AS losing_trade_count,
               COALESCE(SUM(realized_pnl), 0)::text AS realized_pnl_total
        FROM trading_closed_trades
        WHERE workspace_id IN (
          SELECT id FROM workspaces WHERE owner_id = $1
          UNION
          SELECT workspace_id FROM workspace_memberships WHERE user_id = $1 AND status = 'active'
        )
        `,
        [userId],
      ),
      db.query(
        `
        SELECT id, instrument, side, quantity, entry_price, exit_price, realized_pnl,
               fee_asset, exchange_code, closed_at
        FROM trading_closed_trades
        WHERE workspace_id IN (
          SELECT id FROM workspaces WHERE owner_id = $1
          UNION
          SELECT workspace_id FROM workspace_memberships WHERE user_id = $1 AND status = 'active'
        )
        ORDER BY closed_at DESC
        LIMIT 20
        `,
        [userId],
      ),
      db.query(
        `
        SELECT id, instrument, side, type, status, quantity, filled_quantity,
               average_fill_price, created_at, updated_at
        FROM trading_orders
        WHERE workspace_id IN (
          SELECT id FROM workspaces WHERE owner_id = $1
          UNION
          SELECT workspace_id FROM workspace_memberships WHERE user_id = $1 AND status = 'active'
        )
        ORDER BY created_at DESC
        LIMIT 20
        `,
        [userId],
      ),
      db.query(
        `
        SELECT instrument, side, quantity, entry_price, mark_price, unrealized_pnl,
               realized_pnl, updated_at
        FROM trading_positions
        WHERE workspace_id IN (
          SELECT id FROM workspaces WHERE owner_id = $1
          UNION
          SELECT workspace_id FROM workspace_memberships WHERE user_id = $1 AND status = 'active'
        )
        ORDER BY updated_at DESC
        LIMIT 20
        `,
        [userId],
      ),
      db.query(
        `
        SELECT COALESCE(settings.mfa_enabled_at IS NOT NULL, false) AS mfa_enabled,
               (SELECT COUNT(*)::int FROM trusted_devices device
                WHERE device.user_id = account.id AND device.revoked_at IS NULL) AS trusted_device_count,
               (SELECT COUNT(*)::int FROM user_sessions session
                WHERE session.user_id = account.id AND session.revoked_at IS NULL
                  AND session.expires_at > now()) AS active_session_count
        FROM users account
        LEFT JOIN user_security_settings settings ON settings.user_id = account.id
        WHERE account.id = $1
        `,
        [userId],
      ),
    ]);

    // Audit
    await audit.write({
      actorId,
      action: 'user.viewed',
      targetResource: 'user',
      targetId: userId,
    });

    const security = securitySummary.rows[0] ?? {};
    const safeUser = {
      ...sanitizeUser(user),
      mfaEnabled: security.mfa_enabled ?? false,
      trustedDeviceCount: security.trusted_device_count ?? 0,
      activeSessionCount: security.active_session_count ?? 0,
      lastActivityAt: sessions.rows[0]?.last_activity_at ?? null,
      recentSecurityEvents: events.rows.map((event) => ({
        ...camelizeRow(event),
        type: event.event_type,
      })),
    };

    return {
      user: safeUser,
      securityEvents: events.rows.map((event) => ({
        ...camelizeRow(event),
        type: event.event_type,
      })),
      sessions: sessions.rows.map(camelizeRow),
      workspaces: workspaces.rows.map((workspace) => ({
        ...camelizeRow(workspace),
        roleName: workspace.role,
        joinedAt: workspace.joined_at,
        isOwner: workspace.is_owner,
      })),
      subscriptions: subscriptions.rows.map(camelizeRow),
      marketplaceSubscriptions: marketplaceSubscriptions.rows.map(camelizeRow),
      tradingSummary: camelizeRow(tradingSummary.rows[0] ?? {}),
      recentTrades: recentTrades.rows.map(camelizeRow),
      recentOrders: recentOrders.rows.map(camelizeRow),
      positions: positions.rows.map(camelizeRow),
    };
  }

  function sanitizeUser(user) {
    const fields = [
      'id',
      'email',
      'email_verified_at',
      'username',
      'display_name',
      'avatar_url',
      'preferred_language',
      'timezone',
      'country_code',
      'status',
      'terms_version',
      'terms_accepted_at',
      'privacy_version',
      'privacy_accepted_at',
      'created_at',
      'updated_at',
    ];
    return Object.fromEntries(
      fields
        .filter((field) => user[field] !== undefined)
        .map((field) => [field.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase()), user[field]]),
    );
  }

  function camelizeRow(row) {
    return Object.fromEntries(
      Object.entries(row).map(([field, value]) => [
        field.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase()),
        value,
      ]),
    );
  }

  async function suspendUser({ userId, actorId, reason, scope, durationHours }) {
    const user = await db.query(
      `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    if (user.rows.length === 0) throw new NotFoundError('User');

    return db.tx(async (tx) => {
      const before = { status: user.rows[0].status };
      const updated = await tx.query(
        `
        UPDATE users SET status = 'suspended', updated_at = now()
        WHERE id = $1
        RETURNING id, email, username, status
        `,
        [userId]
      );

      await tx.query(
        `
        INSERT INTO user_security_events (user_id, event_type, outcome, metadata)
        VALUES ($1, 'account_restricted', 'success', $2)
        `,
        [userId, JSON.stringify({ scope, durationHours, reason, actorId })]
      );

      await audit.write({
        actorId,
        action: 'user.suspended',
        targetResource: 'user',
        targetId: userId,
        before,
        after: { status: 'suspended' },
        reason,
      });

      await events.publish(
        tx,
        'user.restricted',
        { userId, reason, scope },
        {
          actorId,
          resourceType: 'user',
          resourceId: userId,
        }
      );

      return updated.rows[0];
    });
  }

  async function restoreUser({ userId, actorId, reason }) {
    return db.tx(async (tx) => {
      const before = await tx.query(`SELECT status FROM users WHERE id = $1`, [userId]);
      const updated = await tx.query(
        `
        UPDATE users SET status = 'active', updated_at = now()
        WHERE id = $1
        RETURNING id, email, username, status
        `,
        [userId]
      );

      await tx.query(
        `
        INSERT INTO user_security_events (user_id, event_type, outcome, metadata)
        VALUES ($1, 'account_restored', 'success', $2)
        `,
        [userId, JSON.stringify({ reason, actorId })]
      );

      await audit.write({
        actorId,
        action: 'user.restored',
        targetResource: 'user',
        targetId: userId,
        before: before.rows[0],
        after: { status: 'active' },
        reason,
      });

      await events.publish(
        tx,
        'user.restored',
        { userId, reason },
        {
          actorId,
          resourceType: 'user',
          resourceId: userId,
        }
      );

      return updated.rows[0];
    });
  }

  async function revokeUserSessions({ userId, actorId, reason }) {
    return db.tx(async (tx) => {
      const result = await tx.query(
        `
        UPDATE user_sessions SET revoked_at = now()
        WHERE user_id = $1 AND revoked_at IS NULL
        RETURNING id
        `,
        [userId]
      );

      await audit.write({
        actorId,
        action: 'user.sessions.revoked',
        targetResource: 'user',
        targetId: userId,
        after: { count: result.rowCount },
        reason,
      });

      return { revoked: result.rowCount };
    });
  }

  async function requireMfaReset({ userId, actorId, reason }) {
    const user = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (user.rows.length === 0) throw new NotFoundError('User');

    return db.tx(async (tx) => {
      await tx.query(
        `
        UPDATE user_security_settings
        SET mfa_enabled_at = NULL,
            mfa_secret_encrypted = NULL,
            mfa_secret_pending_encrypted = NULL,
            security_settings_updated_at = now()
        WHERE user_id = $1
        `,
        [userId]
      );

      await tx.query(
        `
        UPDATE user_recovery_codes SET revoked_at = now()
        WHERE user_id = $1 AND revoked_at IS NULL
        `,
        [userId]
      );

      await tx.query(
        `
        INSERT INTO user_security_events (user_id, event_type, outcome, metadata)
        VALUES ($1, 'mfa_reset', 'success', $2)
        `,
        [userId, JSON.stringify({ reason, actorId })]
      );

      await audit.write({
        actorId,
        action: 'user.mfa_reset',
        targetResource: 'user',
        targetId: userId,
        reason,
      });

      return { ok: true };
    });
  }

  return {
    searchUsers,
    getUser,
    suspendUser,
    restoreUser,
    revokeUserSessions,
    requireMfaReset,
  };
}

export default createAdminUserService;