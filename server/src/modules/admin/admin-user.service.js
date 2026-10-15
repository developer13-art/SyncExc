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
    const rows = selectedRows.map(({ total_count: _totalCount, ...row }) => row);
    const last = rows[rows.length - 1];
    return {
      rows,
      nextCursor: hasMore && last ? last.created_at.toISOString() : null,
      total,
    };
  }

  async function getUser({ userId, actorId }) {
    const userResult = await db.query(
      `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    const user = userResult.rows[0];
    if (!user) throw new NotFoundError('User');

    // Security events
    const events = await db.query(
      `
      SELECT * FROM user_security_events
      WHERE user_id = $1
      ORDER BY occurred_at DESC
      LIMIT 20
      `,
      [userId]
    );

    // Sessions
    const sessions = await db.query(
      `
      SELECT id, device_label, ip_address, created_at, last_activity_at, expires_at, revoked_at
      FROM user_sessions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20
      `,
      [userId]
    );

    // Workspaces
    const workspaces = await db.query(
      `
      SELECT w.id, w.name, w.type, w.status, m.role
      FROM workspaces w
      JOIN workspace_memberships m ON m.workspace_id = w.id
      WHERE m.user_id = $1 AND m.status = 'active'
      `,
      [userId]
    );

    // Subscriptions
    const subscriptions = await db.query(
      `
      SELECT * FROM subscriptions
      WHERE billing_scope_type = 'user' AND billing_scope_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    // Audit
    await audit.write({
      actorId,
      action: 'user.viewed',
      targetResource: 'user',
      targetId: userId,
    });

    return {
      user: sanitizeUser(user),
      securityEvents: events.rows,
      sessions: sessions.rows,
      workspaces: workspaces.rows,
      subscriptions: subscriptions.rows,
    };
  }

  function sanitizeUser(user) {
    // Never expose password_hash, mfa secrets, recovery codes, session tokens
    const { password_hash, ...safe } = user;
    return safe;
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