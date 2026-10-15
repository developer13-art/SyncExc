/**
 * SyncExc Server — Admin workspace service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createAdminWorkspaceService({ db, queries, events, audit, logger }) {
  async function searchWorkspaces({ query, type, status, limit = 50, cursor = null, offset } = {}) {
    const params = [limit + 1];
    const conditions = [];
    if (query) {
      params.push(`%${query}%`);
      conditions.push(`name ILIKE $${params.length}`);
    }
    if (type) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (cursor) {
      params.push(cursor);
      conditions.push(`created_at < $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `
      SELECT w.*, u.email AS owner_email, COUNT(*) OVER () AS total_count
      FROM workspaces w      JOIN users u ON u.id = w.owner_id
      ${where}
      ORDER BY w.created_at DESC
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

  async function getWorkspace({ workspaceId, actorId }) {
    const workspace = await db.query(
      `SELECT * FROM workspaces WHERE id = $1`,
      [workspaceId]
    );
    if (workspace.rows.length === 0) throw new NotFoundError('Workspace');

    const members = await db.query(
      `
      SELECT m.*, u.email AS user_email, u.username
      FROM workspace_memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = $1
      `,
      [workspaceId]
    );

    const subscriptions = await db.query(
      `
      SELECT * FROM subscriptions
      WHERE billing_scope_type = 'workspace' AND billing_scope_id = $1
      ORDER BY created_at DESC
      `,
      [workspaceId]
    );

    const shares = await db.query(
      `
      SELECT * FROM connection_sharing_grants
      WHERE home_workspace_id = $1 OR recipient_workspace_id = $1
      `,
      [workspaceId]
    );

    await audit.write({
      actorId,
      action: 'workspace.viewed',
      resourceType: 'workspace',
      resourceId: workspaceId,
    });

    return {
      workspace: workspace.rows[0],
      members: members.rows,
      subscriptions: subscriptions.rows,
      shares: shares.rows,
    };
  }

  async function suspendWorkspace({ workspaceId, actorId, reason }) {
    return db.tx(async (tx) => {
      const before = await tx.query(`SELECT status FROM workspaces WHERE id = $1`, [workspaceId]);
      if (before.rows.length === 0) throw new NotFoundError('Workspace');

      const updated = await tx.query(
        `
        UPDATE workspaces SET status = 'suspended', updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [workspaceId]
      );

      await audit.write({
        actorId,
        action: 'workspace.suspended',
        resourceType: 'workspace',
        resourceId: workspaceId,
        before: before.rows[0],
        after: { status: 'suspended' },
        reason,
      });

      return updated.rows[0];
    });
  }

  async function restoreWorkspace({ workspaceId, actorId, reason }) {
    return db.tx(async (tx) => {
      const before = await tx.query(`SELECT status FROM workspaces WHERE id = $1`, [workspaceId]);
      const updated = await tx.query(
        `
        UPDATE workspaces SET status = 'active', updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [workspaceId]
      );

      await audit.write({
        actorId,
        action: 'workspace.restored',
        resourceType: 'workspace',
        resourceId: workspaceId,
        before: before.rows[0],
        after: { status: 'active' },
        reason,
      });

      return updated.rows[0];
    });
  }

  async function revokeShareGrant({ grantId, actorId, reason }) {
    return db.tx(async (tx) => {
      const before = await tx.query(
        `SELECT * FROM connection_sharing_grants WHERE id = $1`,
        [grantId]
      );
      if (before.rows.length === 0) throw new NotFoundError('Grant');

      const updated = await tx.query(
        `
        UPDATE connection_sharing_grants
        SET status = 'revoked', revoked_at = now()
        WHERE id = $1 AND status IN ('pending', 'active')
        RETURNING *
        `,
        [grantId]
      );

      await audit.write({
        actorId,
        action: 'connection_share.revoked',
        resourceType: 'connection_sharing_grant',
        resourceId: grantId,
        before: before.rows[0],
        after: updated.rows[0],
        reason,
      });

      return updated.rows[0];
    });
  }

  return {
    searchWorkspaces,
    getWorkspace,
    suspendWorkspace,
    restoreWorkspace,
    revokeShareGrant,
  };
}

export default createAdminWorkspaceService;