/**
 * SyncExc Server — Workspaces service
 */

import { randomUUID, createHash } from 'node:crypto';
import { randomToken } from '../../lib/crypto.js';
import {
  AppError,
  ValidationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from '../../lib/errors.js';
import { WORKSPACE_ROLE, PERMISSION } from '@syncexc/shared';
import DEFAULT_WORKSPACE_ROLES from '../../database/seeds/roles.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OWNERSHIP_TRANSFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/**
 * Role → permission mapping used to compute effective permissions. System
 * roles are seeded into `workspace_roles` per workspace; this map is the
 * fallback used before seeding completes.
 */
function permissionsForRole(role) {
  const roleDef = DEFAULT_WORKSPACE_ROLES.find((r) => r.name === role);
  return roleDef ? roleDef.permissions : [];
}

export function createWorkspacesService({ db, queries, rateLimiter, mailer, events, audit, logger }) {
  /* ===========================================================================
   * WORKSPACES
   * ======================================================================== */

  async function ensurePersonalWorkspace(userId) {
    const existing = await queries.findPersonalWorkspaceForUser(userId);
    if (existing) return existing;

    return db.tx(async (tx) => {
      const workspace = await queries.insertWorkspace(tx, {
        name: 'Personal',
        type: 'personal',
        ownerId: userId,
      });

      // Seed roles for the new workspace
      await seedRolesForWorkspace(tx, workspace.id);

      // Add the owner
      await queries.insertMembership(tx, {
        workspaceId: workspace.id,
        userId,
        role: 'owner',
        status: 'active',
      });

      await events.publish(
        tx,
        'workspace.created',
        { workspaceId: workspace.id, type: 'personal', ownerId: userId },
        {
          actorId: userId,
          workspaceId: workspace.id,
          resourceType: 'workspace',
          resourceId: workspace.id,
        }
      );

      return workspace;
    });
  }

  async function createOrganizationWorkspace({ userId, name, description, timezone, preferredLanguage }) {
    // Basic limits: one organization workspace per personal subscription tier
    const existingCount = await db.query(
      `
      SELECT count(*)::int AS count
      FROM workspaces
      WHERE owner_id = $1 AND type = 'organization' AND status <> 'closed'
      `,
      [userId]
    );
    if (existingCount.rows[0].count >= 10) {
      throw new AppError('Workspace creation limit reached', {
        code: 'WORKSPACE_LIMIT_REACHED',
        status: 402,
        expose: true,
      });
    }

    return db.tx(async (tx) => {
      const workspace = await queries.insertWorkspace(tx, {
        name,
        type: 'organization',
        ownerId: userId,
        description,
        timezone,
        preferredLanguage,
      });

      await seedRolesForWorkspace(tx, workspace.id);

      await queries.insertMembership(tx, {
        workspaceId: workspace.id,
        userId,
        role: 'owner',
        status: 'active',
      });

      await events.publish(
        tx,
        'workspace.created',
        { workspaceId: workspace.id, type: 'organization', ownerId: userId, name },
        {
          actorId: userId,
          workspaceId: workspace.id,
          resourceType: 'workspace',
          resourceId: workspace.id,
        }
      );

      await queries.insertWorkspaceAuditEvent({
        workspaceId: workspace.id,
        actorId: userId,
        eventType: 'workspace.created',
        metadata: { type: 'organization', name },
      });

      return workspace;
    });
  }

  async function seedRolesForWorkspace(client, workspaceId) {
    for (const roleDef of DEFAULT_WORKSPACE_ROLES) {
      const existing = await client.query(
        `SELECT 1 FROM workspace_roles WHERE workspace_id = $1 AND name = $2 LIMIT 1`,
        [workspaceId, roleDef.name]
      );
      if (existing.rows.length > 0) continue;
      await queries.insertRole(client, {
        workspaceId,
        name: roleDef.name,
        description: roleDef.description,
        permissions: roleDef.permissions,
        isSystem: roleDef.isSystem,
      });
    }
  }

  async function getWorkspaceById(id) {
    return queries.findWorkspaceById(id);
  }

  async function listWorkspacesForUser(userId) {
    return queries.listWorkspacesForUser(userId);
  }

  async function getActiveWorkspaceIdsForUser(userId) {
    return queries.listActiveWorkspaceIdsForUser(userId);
  }

  async function updateWorkspace({ userId, workspaceId, updates }) {
    const membership = await getMembership({ userId, workspaceId });
    if (!membership || membership.status !== 'active') {
      throw new NotFoundError('Workspace');
    }
    if (
      membership.role !== WORKSPACE_ROLE.OWNER &&
      membership.role !== WORKSPACE_ROLE.ADMINISTRATOR
    ) {
      throw new AuthorizationError('Insufficient permissions');
    }

    return db.tx(async (tx) => {
      const updated = await tx.query(
        `
        UPDATE workspaces
        SET name = COALESCE($2, name),
            description = COALESCE($3, description),
            timezone = COALESCE($4, timezone),
            preferred_language = COALESCE($5, preferred_language),
            settings = COALESCE($6::jsonb, settings),
            updated_at = now()
        WHERE id = $1 AND status <> 'closed'
        RETURNING *
        `,
        [
          workspaceId,
          updates.name ?? null,
          updates.description ?? null,
          updates.timezone ?? null,
          updates.preferredLanguage ?? null,
          updates.settings ? JSON.stringify(updates.settings) : null,
        ]
      );

      await events.publish(
        tx,
        'workspace.updated',
        { workspaceId, changes: updates },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'workspace',
          resourceId: workspaceId,
        }
      );

      await tx.query(
        `
        INSERT INTO workspace_audit_events (workspace_id, actor_id, event_type, metadata)
        VALUES ($1, $2, 'workspace.updated', $3)
        `,
        [workspaceId, userId, JSON.stringify({ changes: updates })]
      );

      return updated.rows[0];
    });
  }

  /* ===========================================================================
   * MEMBERSHIPS
   * ======================================================================== */

  async function getMembership({ userId, workspaceId }) {
    return queries.findMembership(workspaceId, userId);
  }

  async function listMembers({ userId, workspaceId }) {
    await requirePermission({ userId, workspaceId, permission: PERMISSION.MEMBERS_VIEW });
    return queries.listMembers(workspaceId);
  }

  async function updateMemberRole({ actorId, workspaceId, targetUserId, role }) {
    await requirePermission({
      userId: actorId,
      workspaceId,
      permission: PERMISSION.MEMBERS_ROLE_UPDATE,
    });

    const actorMembership = await getMembership({ userId: actorId, workspaceId });
    if (actorMembership.role !== WORKSPACE_ROLE.OWNER && role === WORKSPACE_ROLE.OWNER) {
      throw new AuthorizationError('Only the owner can assign the owner role');
    }
    if (targetUserId === actorId && role !== actorMembership.role) {
      throw new AuthorizationError('You cannot change your own role');
    }

    const target = await getMembership({ userId: targetUserId, workspaceId });
    if (!target || target.status !== 'active') throw new NotFoundError('Member');

    return db.tx(async (tx) => {
      const updated = await tx.query(
        `
        UPDATE workspace_memberships
        SET role = $3, updated_at = now()
        WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
        RETURNING *
        `,
        [workspaceId, targetUserId, role]
      );

      await events.publish(
        tx,
        'workspace.member_role_changed',
        { workspaceId, userId: targetUserId, previousRole: target.role, newRole: role },
        {
          actorId,
          workspaceId,
          resourceType: 'workspace_membership',
          resourceId: updated.rows[0].id,
        }
      );

      await tx.query(
        `
        INSERT INTO workspace_audit_events (
          workspace_id, actor_id, event_type, target_user_id, metadata
        )
        VALUES ($1, $2, 'member.role_changed', $3, $4)
        `,
        [
          workspaceId,
          actorId,
          targetUserId,
          JSON.stringify({ from: target.role, to: role }),
        ]
      );

      return updated.rows[0];
    });
  }

  async function suspendMember({ actorId, workspaceId, targetUserId }) {
    await requirePermission({
      userId: actorId,
      workspaceId,
      permission: PERMISSION.MEMBERS_REMOVE,
    });

    if (targetUserId === actorId) {
      throw new ConflictError('You cannot suspend yourself', 'SELF_SUSPEND_FORBIDDEN');
    }

    const target = await getMembership({ userId: targetUserId, workspaceId });
    if (!target) throw new NotFoundError('Member');
    if (target.role === WORKSPACE_ROLE.OWNER) {
      const ownerCount = await queries.countActiveOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new ConflictError('Cannot suspend the last owner', 'LAST_OWNER');
      }
    }

    return db.tx(async (tx) => {
      const updated = await tx.query(
        `
        UPDATE workspace_memberships
        SET status = 'suspended', updated_at = now()
        WHERE workspace_id = $1 AND user_id = $2
        RETURNING *
        `,
        [workspaceId, targetUserId]
      );

      await events.publish(
        tx,
        'workspace.member_suspended',
        { workspaceId, userId: targetUserId },
        {
          actorId,
          workspaceId,
          resourceType: 'workspace_membership',
          resourceId: updated.rows[0].id,
        }
      );

      await tx.query(
        `
        INSERT INTO workspace_audit_events (
          workspace_id, actor_id, event_type, target_user_id
        )
        VALUES ($1, $2, 'member.suspended', $3)
        `,
        [workspaceId, actorId, targetUserId]
      );

      return updated.rows[0];
    });
  }

  async function removeMember({ actorId, workspaceId, targetUserId }) {
    await requirePermission({
      userId: actorId,
      workspaceId,
      permission: PERMISSION.MEMBERS_REMOVE,
    });

    if (targetUserId === actorId) {
      throw new ConflictError('You cannot remove yourself', 'SELF_REMOVE_FORBIDDEN');
    }

    const target = await getMembership({ userId: targetUserId, workspaceId });
    if (!target) throw new NotFoundError('Member');
    if (target.role === WORKSPACE_ROLE.OWNER) {
      const ownerCount = await queries.countActiveOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new ConflictError('Cannot remove the last owner', 'LAST_OWNER');
      }
    }

    return db.tx(async (tx) => {
      const updated = await tx.query(
        `
        UPDATE workspace_memberships
        SET status = 'removed', removed_at = now(), updated_at = now()
        WHERE workspace_id = $1 AND user_id = $2
        RETURNING *
        `,
        [workspaceId, targetUserId]
      );

      await events.publish(
        tx,
        'workspace.member_removed',
        { workspaceId, userId: targetUserId },
        {
          actorId,
          workspaceId,
          resourceType: 'workspace_membership',
          resourceId: updated.rows[0].id,
        }
      );

      await tx.query(
        `
        INSERT INTO workspace_audit_events (
          workspace_id, actor_id, event_type, target_user_id
        )
        VALUES ($1, $2, 'member.removed', $3)
        `,
        [workspaceId, actorId, targetUserId]
      );

      return updated.rows[0];
    });
  }

  /* ===========================================================================
   * INVITATIONS
   * ======================================================================== */

  async function inviteMember({ actorId, workspaceId, email, role, expiresInDays }) {
    await requirePermission({
      userId: actorId,
      workspaceId,
      permission: PERMISSION.MEMBERS_INVITE,
    });

    const emailNormalized = normalizeEmail(email);

    const existing = await db.query(
      `SELECT id FROM users WHERE email_normalized = $1 AND deleted_at IS NULL`,
      [emailNormalized]
    );
    if (existing.rows.length > 0) {
      const membership = await getMembership({
        userId: existing.rows[0].id,
        workspaceId,
      });
      if (membership && membership.status === 'active') {
        throw new ConflictError('User is already a member', 'ALREADY_MEMBER');
      }
    }

    const pending = await queries.findPendingInvitationByEmail(workspaceId, emailNormalized);
    if (pending) {
      throw new ConflictError('A pending invitation already exists for this email', 'INVITE_PENDING');
    }

    const token = randomToken(32);
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + (expiresInDays || 7) * 24 * 60 * 60 * 1000);

    const result = await db.tx(async (tx) => {
      const invitation = await queries.insertInvitation(tx, {
        workspaceId,
        email,
        emailNormalized,
        role,
        tokenHash,
        invitedBy: actorId,
        expiresAt,
      });

      await events.publish(
        tx,
        'workspace.invitation_sent',
        { workspaceId, email, role },
        {
          actorId,
          workspaceId,
          resourceType: 'workspace_invitation',
          resourceId: invitation.id,
        }
      );

      await tx.query(
        `
        INSERT INTO workspace_audit_events (
          workspace_id, actor_id, event_type, metadata
        )
        VALUES ($1, $2, 'invitation.sent', $3)
        `,
        [workspaceId, actorId, JSON.stringify({ email, role })]
      );

      return invitation;
    });

    if (mailer) {
      const url = `${process.env.APP_URL || 'http://localhost:5173'}/accept-invitation?token=${token}`;
      await mailer
        .send({
          to: email,
          subject: 'You have been invited to a SyncExc workspace',
          text: `Accept the invitation by visiting: ${url}`,
          html: `<p>You have been invited to join a SyncExc workspace. Click <a href="${url}">this link</a> to accept.</p>`,
        })
        .catch((err) => logger.error({ err }, 'Failed to send invitation email'));
    }

    return { invitation: result, token };
  }

  async function acceptInvitation({ userId, token }) {
    const tokenHash = hashToken(token);
    const invitation = await queries.findInvitationByTokenHash(tokenHash);

    if (!invitation || invitation.status !== 'pending') {
      throw new ValidationError('Invalid or expired invitation');
    }
    if (new Date(invitation.expires_at) <= new Date()) {
      throw new ValidationError('Invitation expired');
    }

    return db.tx(async (tx) => {
      const existingMembership = await tx.query(
        `
        SELECT id, status FROM workspace_memberships
        WHERE workspace_id = $1 AND user_id = $2
        LIMIT 1
        `,
        [invitation.workspace_id, userId]
      );

      if (existingMembership.rows.length > 0) {
        await tx.query(
          `
          UPDATE workspace_memberships
          SET status = 'active', role = $3, updated_at = now()
          WHERE workspace_id = $1 AND user_id = $2
          `,
          [invitation.workspace_id, userId, invitation.role]
        );
      } else {
        await queries.insertMembership(tx, {
          workspaceId: invitation.workspace_id,
          userId,
          role: invitation.role,
          status: 'active',
          invitedBy: invitation.invited_by,
        });
      }

      await tx.query(
        `
        UPDATE workspace_invitations
        SET status = 'accepted', accepted_at = now()
        WHERE id = $1
        `,
        [invitation.id]
      );

      await events.publish(
        tx,
        'workspace.invitation_accepted',
        { workspaceId: invitation.workspace_id, userId, role: invitation.role },
        {
          actorId: userId,
          workspaceId: invitation.workspace_id,
          resourceType: 'workspace_invitation',
          resourceId: invitation.id,
        }
      );

      return { workspaceId: invitation.workspace_id, role: invitation.role };
    });
  }

  async function revokeInvitation({ actorId, workspaceId, invitationId }) {
    await requirePermission({
      userId: actorId,
      workspaceId,
      permission: PERMISSION.MEMBERS_INVITE,
    });

    const revoked = await queries.revokeInvitation(invitationId, workspaceId);
    if (!revoked) throw new NotFoundError('Invitation');

    await queries.insertWorkspaceAuditEvent({
      workspaceId,
      actorId,
      eventType: 'invitation.revoked',
      metadata: { invitationId },
    });

    return { ok: true };
  }

  async function resendInvitation({ actorId, workspaceId, invitationId }) {
    await requirePermission({
      userId: actorId,
      workspaceId,
      permission: PERMISSION.MEMBERS_INVITE,
    });

    const result = await db.query(
      `
      SELECT * FROM workspace_invitations
      WHERE id = $1 AND workspace_id = $2 AND status = 'pending'
      `,
      [invitationId, workspaceId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Invitation');

    const invitation = result.rows[0];
    const token = randomToken(32);
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    await db.query(
      `
      UPDATE workspace_invitations
      SET token_hash = $2, expires_at = $3
      WHERE id = $1
      `,
      [invitation.id, tokenHash, expiresAt]
    );

    if (mailer) {
      const url = `${process.env.APP_URL || 'http://localhost:5173'}/accept-invitation?token=${token}`;
      await mailer
        .send({
          to: invitation.email,
          subject: 'Reminder: You have been invited to a SyncExc workspace',
          text: `Accept the invitation by visiting: ${url}`,
        })
        .catch((err) => logger.error({ err }, 'Failed to resend invitation email'));
    }

    return { ok: true };
  }

  async function listInvitations({ userId, workspaceId }) {
    await requirePermission({
      userId,
      workspaceId,
      permission: PERMISSION.MEMBERS_VIEW,
    });
    return queries.listInvitations(workspaceId);
  }

  /* ===========================================================================
   * PERMISSIONS
   * ======================================================================== */

  async function getEffectivePermissions({ userId, workspaceId }) {
    const membership = await queries.findMembership(workspaceId, userId);
    if (!membership || membership.status !== 'active') return [];

    // Load the role definition for the workspace
    const roleResult = await db.query(
      `
      SELECT permissions FROM workspace_roles
      WHERE workspace_id = $1 AND name = $2
      LIMIT 1
      `,
      [workspaceId, membership.role]
    );

    let rolePermissions = roleResult.rows[0]?.permissions;
    if (!rolePermissions) {
      rolePermissions = permissionsForRole(membership.role);
    }

    // Owner has all permissions
    if (membership.role === WORKSPACE_ROLE.OWNER) {
      return Object.values(PERMISSION);
    }

    // Merge role permissions with extra permissions
    const extras = membership.extra_permissions || [];
    return Array.from(new Set([...rolePermissions, ...extras]));
  }

  async function hasPermission({ userId, workspaceId, permission }) {
    const perms = await getEffectivePermissions({ userId, workspaceId });
    return perms.includes(permission);
  }

  async function requirePermission({ userId, workspaceId, permission }) {
    const ok = await hasPermission({ userId, workspaceId, permission });
    if (!ok) {
      throw new AuthorizationError(`Missing permission: ${permission}`, 'PERMISSION_DENIED');
    }
  }

  /* ===========================================================================
   * ROLES
   * ======================================================================== */

  async function listRoles({ userId, workspaceId }) {
    const membership = await getMembership({ userId, workspaceId });
    if (!membership || membership.status !== 'active') {
      throw new NotFoundError('Workspace');
    }
    return queries.listRolesForWorkspace(workspaceId);
  }

  /* ===========================================================================
   * CONNECTION SHARING GRANTS
   * ======================================================================== */

  async function listShareGrantsForRecipient({ userId, workspaceId }) {
    await requirePermission({
      userId,
      workspaceId,
      permission: PERMISSION.CONNECTIONS_VIEW,
    });
    return queries.listGrantsForRecipient(workspaceId);
  }

  async function listShareGrantsForConnection({ userId, connectionId }) {
    const rows = await queries.listActiveGrantsForConnection(connectionId);
    return rows;
  }

  async function createShareGrant({
    userId,
    homeWorkspaceId,
    connectionId,
    recipientWorkspaceId,
    allowedOperations,
    expiresAt,
  }) {
    await requirePermission({
      userId,
      workspaceId: homeWorkspaceId,
      permission: PERMISSION.CONNECTIONS_SHARE,
    });

    // Verify recipient exists
    const recipient = await queries.findWorkspaceById(recipientWorkspaceId);
    if (!recipient) throw new NotFoundError('Recipient workspace');

    return db.tx(async (tx) => {
      const grant = await queries.insertShareGrant(tx, {
        connectionId,
        homeWorkspaceId,
        recipientWorkspaceId,
        allowedOperations,
        status: 'active',
        grantedBy: userId,
        expiresAt,
      });

      await events.publish(
        tx,
        'workspace.connection_share_granted',
        {
          workspaceId: homeWorkspaceId,
          connectionId,
          recipientWorkspaceId,
          allowedOperations,
        },
        {
          actorId: userId,
          workspaceId: homeWorkspaceId,
          resourceType: 'connection_sharing_grant',
          resourceId: grant.id,
        }
      );

      return grant;
    });
  }

  async function revokeShareGrant({ userId, workspaceId, grantId }) {
    await requirePermission({
      userId,
      workspaceId,
      permission: PERMISSION.CONNECTIONS_GRANTS_REVOKE,
    });

    const grant = await queries.findShareGrant(grantId);
    if (!grant) throw new NotFoundError('Share grant');
    if (grant.home_workspace_id !== workspaceId) {
      throw new AuthorizationError('Share grant belongs to a different workspace');
    }

    return db.tx(async (tx) => {
      const revoked = await queries.revokeShareGrant(grantId);
      if (!revoked) throw new NotFoundError('Share grant');

      await events.publish(
        tx,
        'workspace.connection_share_revoked',
        {
          workspaceId,
          connectionId: grant.connection_id,
          recipientWorkspaceId: grant.recipient_workspace_id,
        },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'connection_sharing_grant',
          resourceId: grantId,
        }
      );

      return revoked;
    });
  }

  /* ===========================================================================
   * OWNERSHIP TRANSFERS
   * ======================================================================== */

  async function initiateOwnershipTransfer({ userId, workspaceId, newOwnerUserId, reason }) {
    if (userId !== newOwnerUserId) {
      await requirePermission({
        userId,
        workspaceId,
        permission: PERMISSION.WORKSPACE_UPDATE,
      });
    }

    const membership = await getMembership({ userId, workspaceId });
    if (!membership || membership.role !== WORKSPACE_ROLE.OWNER) {
      throw new AuthorizationError('Only the current owner can initiate an ownership transfer');
    }

    const target = await getMembership({ userId: newOwnerUserId, workspaceId });
    if (!target || target.status !== 'active') {
      throw new NotFoundError('Target user is not an active member');
    }

    return db.tx(async (tx) => {
      const transfer = await queries.insertOwnershipTransfer(tx, {
        workspaceId,
        fromUserId: userId,
        toUserId: newOwnerUserId,
        reason,
        expiresAt: new Date(Date.now() + OWNERSHIP_TRANSFER_TTL_MS),
      });

      await tx.query(
        `
        INSERT INTO workspace_audit_events (
          workspace_id, actor_id, event_type, target_user_id, metadata
        )
        VALUES ($1, $2, 'ownership.transfer_initiated', $3, $4)
        `,
        [
          workspaceId,
          userId,
          newOwnerUserId,
          JSON.stringify({ transferId: transfer.id, reason }),
        ]
      );

      return transfer;
    });
  }

  async function acceptOwnershipTransfer({ userId, transferId }) {
    const transfer = await queries.findOwnershipTransfer(transferId);
    if (!transfer) throw new NotFoundError('Transfer');
    if (transfer.to_user_id !== userId) {
      throw new AuthorizationError('You are not the recipient of this transfer');
    }
    if (transfer.status !== 'pending') {
      throw new ConflictError('Transfer is no longer pending');
    }

    return db.tx(async (tx) => {
      const accepted = await queries.acceptOwnershipTransfer(transferId);
      if (!accepted) throw new ConflictError('Transfer is no longer pending');

      // Update the workspace owner
      await tx.query(
        `
        UPDATE workspaces SET owner_id = $2, updated_at = now()
        WHERE id = $1
        `,
        [transfer.workspace_id, userId]
      );

      // Update memberships: previous owner → administrator, new owner → owner
      await tx.query(
        `
        UPDATE workspace_memberships
        SET role = 'administrator', updated_at = now()
        WHERE workspace_id = $1 AND user_id = $2 AND role = 'owner'
        `,
        [transfer.workspace_id, transfer.from_user_id]
      );
      await tx.query(
        `
        UPDATE workspace_memberships
        SET role = 'owner', updated_at = now()
        WHERE workspace_id = $1 AND user_id = $2
        `,
        [transfer.workspace_id, userId]
      );

      await events.publish(
        tx,
        'workspace.ownership_transferred',
        {
          workspaceId: transfer.workspace_id,
          fromUserId: transfer.from_user_id,
          toUserId: userId,
        },
        {
          actorId: userId,
          workspaceId: transfer.workspace_id,
          resourceType: 'workspace',
          resourceId: transfer.workspace_id,
        }
      );

      return accepted;
    });
  }

  async function cancelOwnershipTransfer({ userId, transferId }) {
    const ok = await queries.cancelOwnershipTransfer(transferId, userId);
    if (!ok) throw new NotFoundError('Transfer');
    return { ok: true };
  }

  /* ===========================================================================
   * WORKSPACE AUDIT
   * ======================================================================== */

  async function listAuditEvents({ userId, workspaceId, limit, cursor }) {
    await requirePermission({
      userId,
      workspaceId,
      permission: PERMISSION.AUDIT_VIEW,
    });
    return queries.listWorkspaceAuditEvents(workspaceId, { limit, cursor });
  }

  /* ===========================================================================
   * EXPORTS
   * ======================================================================== */

  return {
    // Workspaces
    ensurePersonalWorkspace,
    createOrganizationWorkspace,
    getWorkspaceById,
    listWorkspacesForUser,
    getActiveWorkspaceIdsForUser,
    updateWorkspace,

    // Members
    getMembership,
    listMembers,
    updateMemberRole,
    suspendMember,
    removeMember,

    // Invitations
    inviteMember,
    acceptInvitation,
    revokeInvitation,
    resendInvitation,
    listInvitations,

    // Permissions
    getEffectivePermissions,
    hasPermission,
    requirePermission,

    // Roles
    listRoles,

    // Sharing grants
    listShareGrantsForRecipient,
    listShareGrantsForConnection,
    createShareGrant,
    revokeShareGrant,

    // Ownership
    initiateOwnershipTransfer,
    acceptOwnershipTransfer,
    cancelOwnershipTransfer,

    // Audit
    listAuditEvents,
  };
}

export default createWorkspacesService;