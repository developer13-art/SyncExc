/**
 * SyncExc Server — Workspaces queries
 */

export function createWorkspacesQueries({ db }) {
  return {
    /* =========================================================================
     * WORKSPACES
     * ====================================================================== */

    async insertWorkspace(client, data) {
      const result = await client.query(
        `
        INSERT INTO workspaces (
          name, type, owner_id, description, timezone, preferred_language, settings,
          slug, visibility
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          data.name,
          data.type,
          data.ownerId,
          data.description || null,
          data.timezone || 'UTC',
          data.preferredLanguage || 'en',
          JSON.stringify(data.settings || {}),
          data.slug || null,
          data.visibility || 'private',
        ]
      );
      return result.rows[0];
    },

    async findWorkspaceById(id, client = db) {
      const result = await client.query(
        `SELECT * FROM workspaces WHERE id = $1 AND status <> 'closed'`,
        [id]
      );
      return result.rows[0] || null;
    },

    async findPersonalWorkspaceForUser(userId, client = db) {
      const result = await client.query(
        `
        SELECT * FROM workspaces
        WHERE owner_id = $1 AND type = 'personal' AND status <> 'closed'
        LIMIT 1
        `,
        [userId]
      );
      return result.rows[0] || null;
    },

    async listWorkspacesForUser(userId) {
      const result = await db.query(
        `
        SELECT w.*, m.role AS member_role, m.status AS member_status
        FROM workspaces w
        JOIN workspace_memberships m ON m.workspace_id = w.id
        WHERE m.user_id = $1
          AND m.status = 'active'
          AND w.status <> 'closed'
        ORDER BY w.type ASC, w.created_at ASC
        `,
        [userId]
      );
      return result.rows;
    },

    async listActiveWorkspaceIdsForUser(userId) {
      const result = await db.query(
        `
        SELECT workspace_id
        FROM workspace_memberships
        WHERE user_id = $1 AND status = 'active'
        `,
        [userId]
      );
      return result.rows.map((r) => r.workspace_id);
    },

    async updateWorkspace(id, fields) {
      const result = await db.query(
        `
        UPDATE workspaces
        SET name = COALESCE($2, name),
            description = COALESCE($3, description),
            timezone = COALESCE($4, timezone),
            preferred_language = COALESCE($5, preferred_language),
            settings = COALESCE($6, settings),
            updated_at = now()
        WHERE id = $1 AND status <> 'closed'
        RETURNING *
        `,
        [
          id,
          fields.name ?? null,
          fields.description ?? null,
          fields.timezone ?? null,
          fields.preferredLanguage ?? null,
          fields.settings ? JSON.stringify(fields.settings) : null,
        ]
      );
      return result.rows[0] || null;
    },

    async setWorkspaceStatus(id, status, client = db) {
      const result = await client.query(
        `
        UPDATE workspaces SET status = $2, updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [id, status]
      );
      return result.rows[0] || null;
    },

    async insertWorkspaceLifecycleEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO workspace_lifecycle_events (
          workspace_id, actor_id, action, previous_status, next_status, reason
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.actorId,
          data.action,
          data.previousStatus,
          data.nextStatus,
          data.reason || null,
        ]
      );
      return result.rows[0];
    },

    async setWorkspaceOwner(id, newOwnerId) {
      const result = await db.query(
        `
        UPDATE workspaces SET owner_id = $2, updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [id, newOwnerId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * MEMBERSHIPS
     * ====================================================================== */

    async insertMembership(client, data) {
      const result = await client.query(
        `
        INSERT INTO workspace_memberships (
          workspace_id, user_id, role, status, extra_permissions, invited_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.userId,
          data.role,
          data.status || 'active',
          data.extraPermissions || [],
          data.invitedBy || null,
        ]
      );
      return result.rows[0];
    },

    async findMembership(workspaceId, userId) {
      const result = await db.query(
        `
        SELECT * FROM workspace_memberships
        WHERE workspace_id = $1 AND user_id = $2
        LIMIT 1
        `,
        [workspaceId, userId]
      );
      return result.rows[0] || null;
    },

    async listMembers(workspaceId) {
      const result = await db.query(
        `
        SELECT m.*, u.email, u.username, u.display_name, u.avatar_url, u.status AS user_status
        FROM workspace_memberships m
        JOIN users u ON u.id = m.user_id
        WHERE m.workspace_id = $1 AND m.status <> 'removed'
        ORDER BY m.role ASC, m.created_at ASC
        `,
        [workspaceId]
      );
      return result.rows;
    },

    async updateMembershipRole(workspaceId, userId, role) {
      const result = await db.query(
        `
        UPDATE workspace_memberships
        SET role = $3, updated_at = now()
        WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
        RETURNING *
        `,
        [workspaceId, userId, role]
      );
      return result.rows[0] || null;
    },

    async updateMembershipExtraPermissions(workspaceId, userId, extraPermissions) {
      const result = await db.query(
        `
        UPDATE workspace_memberships
        SET extra_permissions = $3, updated_at = now()
        WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
        RETURNING *
        `,
        [workspaceId, userId, extraPermissions]
      );
      return result.rows[0] || null;
    },

    async setMembershipStatus(workspaceId, userId, status) {
      const result = await db.query(
        `
        UPDATE workspace_memberships
        SET status = $3,
            removed_at = CASE WHEN $3 = 'removed' THEN now() ELSE removed_at END,
            updated_at = now()
        WHERE workspace_id = $1 AND user_id = $2
        RETURNING *
        `,
        [workspaceId, userId, status]
      );
      return result.rows[0] || null;
    },

    async countActiveOwners(workspaceId) {
      const result = await db.query(
        `
        SELECT count(*)::int AS count
        FROM workspace_memberships
        WHERE workspace_id = $1 AND role = 'owner' AND status = 'active'
        `,
        [workspaceId]
      );
      return result.rows[0].count;
    },

    /* =========================================================================
     * ROLES
     * ====================================================================== */

    async listRolesForWorkspace(workspaceId) {
      const result = await db.query(
        `
        SELECT * FROM workspace_roles
        WHERE workspace_id = $1
        ORDER BY is_system DESC, name ASC
        `,
        [workspaceId]
      );
      return result.rows;
    },

    async findRoleByWorkspaceAndName(workspaceId, name) {
      const result = await db.query(
        `
        SELECT * FROM workspace_roles
        WHERE workspace_id = $1 AND name = $2
        LIMIT 1
        `,
        [workspaceId, name]
      );
      return result.rows[0] || null;
    },

    async insertRole(client, data) {
      const result = await client.query(
        `
        INSERT INTO workspace_roles (workspace_id, name, description, permissions, is_system)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.name,
          data.description || null,
          data.permissions || [],
          data.isSystem || false,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * INVITATIONS
     * ====================================================================== */

    async insertInvitation(client, data) {
      const result = await client.query(
        `
        INSERT INTO workspace_invitations (
          workspace_id, email, email_normalized, role, token_hash,
          invited_by, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.email,
          data.emailNormalized,
          data.role,
          data.tokenHash,
          data.invitedBy,
          data.expiresAt,
        ]
      );
      return result.rows[0];
    },

    async findInvitationByTokenHash(tokenHash) {
      const result = await db.query(
        `SELECT * FROM workspace_invitations WHERE token_hash = $1 LIMIT 1`,
        [tokenHash]
      );
      return result.rows[0] || null;
    },

    async listInvitations(workspaceId) {
      const result = await db.query(
        `
        SELECT * FROM workspace_invitations
        WHERE workspace_id = $1
        ORDER BY created_at DESC
        `,
        [workspaceId]
      );
      return result.rows;
    },

    async findPendingInvitationByEmail(workspaceId, emailNormalized) {
      const result = await db.query(
        `
        SELECT * FROM workspace_invitations
        WHERE workspace_id = $1 AND email_normalized = $2 AND status = 'pending'
        LIMIT 1
        `,
        [workspaceId, emailNormalized]
      );
      return result.rows[0] || null;
    },

    async markInvitationAccepted(invitationId) {
      const result = await db.query(
        `
        UPDATE workspace_invitations
        SET status = 'accepted', accepted_at = now()
        WHERE id = $1 AND status = 'pending'
        RETURNING *
        `,
        [invitationId]
      );
      return result.rows[0] || null;
    },

    async revokeInvitation(invitationId, workspaceId) {
      const result = await db.query(
        `
        UPDATE workspace_invitations
        SET status = 'revoked', revoked_at = now()
        WHERE id = $1 AND workspace_id = $2 AND status = 'pending'
        RETURNING id
        `,
        [invitationId, workspaceId]
      );
      return result.rowCount > 0;
    },

    /* =========================================================================
     * CONNECTION SHARING GRANTS
     * ====================================================================== */

    async insertShareGrant(client, data) {
      const result = await client.query(
        `
        INSERT INTO connection_sharing_grants (
          connection_id, home_workspace_id, recipient_workspace_id,
          allowed_operations, status, granted_by, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.connectionId,
          data.homeWorkspaceId,
          data.recipientWorkspaceId,
          data.allowedOperations,
          data.status || 'active',
          data.grantedBy,
          data.expiresAt || null,
        ]
      );
      return result.rows[0];
    },

    async findShareGrant(id) {
      const result = await db.query(
        `SELECT * FROM connection_sharing_grants WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async listActiveGrantsForConnection(connectionId) {
      const result = await db.query(
        `
        SELECT * FROM connection_sharing_grants
        WHERE connection_id = $1 AND status = 'active'
          AND (expires_at IS NULL OR expires_at > now())
        `,
        [connectionId]
      );
      return result.rows;
    },

    async listGrantsForRecipient(workspaceId) {
      const result = await db.query(
        `
        SELECT g.*, c.exchange_code, c.label AS connection_label, c.status AS connection_status
        FROM connection_sharing_grants g
        JOIN exchange_connections c ON c.id = g.connection_id
        WHERE g.recipient_workspace_id = $1 AND g.status = 'active'
          AND (g.expires_at IS NULL OR g.expires_at > now())
        ORDER BY g.created_at DESC
        `,
        [workspaceId]
      );
      return result.rows;
    },

    async revokeShareGrant(id, revokedBy) {
      const result = await db.query(
        `
        UPDATE connection_sharing_grants
        SET status = 'revoked', revoked_at = now()
        WHERE id = $1 AND status IN ('pending', 'active')
        RETURNING *
        `,
        [id]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * OWNERSHIP TRANSFERS
     * ====================================================================== */

    async insertOwnershipTransfer(client, data) {
      const result = await client.query(
        `
        INSERT INTO workspace_ownership_transfers (
          workspace_id, from_user_id, to_user_id, reason, expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.fromUserId,
          data.toUserId,
          data.reason,
          data.expiresAt,
        ]
      );
      return result.rows[0];
    },

    async findOwnershipTransfer(id) {
      const result = await db.query(
        `SELECT * FROM workspace_ownership_transfers WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async acceptOwnershipTransfer(id) {
      const result = await db.query(
        `
        UPDATE workspace_ownership_transfers
        SET status = 'accepted', accepted_at = now()
        WHERE id = $1 AND status = 'pending' AND expires_at > now()
        RETURNING *
        `,
        [id]
      );
      return result.rows[0] || null;
    },

    async cancelOwnershipTransfer(id, userId) {
      const result = await db.query(
        `
        UPDATE workspace_ownership_transfers
        SET status = 'canceled', canceled_at = now()
        WHERE id = $1 AND from_user_id = $2 AND status = 'pending'
        RETURNING id
        `,
        [id, userId]
      );
      return result.rowCount > 0;
    },

    /* =========================================================================
     * WORKSPACE AUDIT EVENTS
     * ====================================================================== */

    async insertWorkspaceAuditEvent(data, client = db) {
      const result = await client.query(
        `
        INSERT INTO workspace_audit_events (
          workspace_id, actor_id, event_type, target_user_id,
          target_resource, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.actorId || null,
          data.eventType,
          data.targetUserId || null,
          data.targetResource || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    async listWorkspaceAuditEvents(workspaceId, { limit = 100, cursor = null } = {}) {
      const params = [workspaceId, limit + 1];
      let cursorClause = '';
      if (cursor) {
        params.push(cursor);
        cursorClause = `AND occurred_at < $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM workspace_audit_events
        WHERE workspace_id = $1
          ${cursorClause}
        ORDER BY occurred_at DESC
        LIMIT $2
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.occurred_at.toISOString() : null,
      };
    },
  };
}

export default createWorkspacesQueries;