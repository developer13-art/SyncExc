/**
 * SyncExc Server — Workspaces controllers
 */

import { serializeWorkspace, serializeWorkspaceMembership, serializeInvitation, serializeConnectionShareGrant, serializeAuditEvent } from '../../lib/serializers.js';
import { success, created, noContent, paginated } from '../../lib/response.js';

export function createWorkspacesController({ service }) {
  return {
    /* =========================================================================
     * WORKSPACES
     * ====================================================================== */

    async list(req, res) {
      let rows = await service.listWorkspacesForUser(req.auth.userId);
      if (rows.length === 0) {
        await service.ensurePersonalWorkspace(req.auth.userId);
        rows = await service.listWorkspacesForUser(req.auth.userId);
      }
      return success(
        res,
        rows.map((w) => ({
          ...serializeWorkspace(w),
          memberRole: w.member_role,
        }))
      );
    },

    async create(req, res) {
      const input = {
        userId: req.auth.userId,
        type: req.body.type || 'trader',
        name: req.body.name,
        description: req.body.description,
        timezone: req.body.timezone,
        preferredLanguage: req.body.preferredLanguage,
      };
      const workspace = input.type === 'organization'
        ? await service.createOrganizationWorkspace(input)
        : await service.createSpecializedWorkspace(input);
      return created(res, serializeWorkspace(workspace));
    },

    async updateLifecycle(req, res) {
      const workspace = await service.updateWorkspaceLifecycle({
        userId: req.auth.userId,
        workspaceId: req.params.workspaceId,
        status: req.body.status,
        reason: req.body.reason,
      });
      return success(res, serializeWorkspace(workspace));
    },

    async get(req, res) {
      const workspace = await service.getWorkspaceById(req.params.workspaceId);
      if (!workspace) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Workspace not found' } });
      return success(res, serializeWorkspace(workspace));
    },

    async getCapabilities(req, res) {
      const capabilities = await service.getWorkspaceCapabilities({
        userId: req.auth.userId,
        workspaceId: req.params.workspaceId,
      });
      return success(res, capabilities);
    },

    async update(req, res) {
      const updated = await service.updateWorkspace({
        userId: req.auth.userId,
        workspaceId: req.params.workspaceId,
        updates: req.body,
      });
      return success(res, serializeWorkspace(updated));
    },

    /* =========================================================================
     * MEMBERS
     * ====================================================================== */

    async listMembers(req, res) {
      const members = await service.listMembers({
        userId: req.auth.userId,
        workspaceId: req.params.workspaceId,
      });
      return success(
        res,
        members.map((m) => ({
          ...serializeWorkspaceMembership(m),
          email: m.email,
          username: m.username,
          displayName: m.display_name,
          avatarUrl: m.avatar_url,
        }))
      );
    },

    async updateMemberRole(req, res) {
      const updated = await service.updateMemberRole({
        actorId: req.auth.userId,
        workspaceId: req.params.workspaceId,
        targetUserId: req.params.userId,
        role: req.body.role,
      });
      return success(res, serializeWorkspaceMembership(updated));
    },

    async suspendMember(req, res) {
      const updated = await service.suspendMember({
        actorId: req.auth.userId,
        workspaceId: req.params.workspaceId,
        targetUserId: req.params.userId,
      });
      return success(res, serializeWorkspaceMembership(updated));
    },

    async removeMember(req, res) {
      const updated = await service.removeMember({
        actorId: req.auth.userId,
        workspaceId: req.params.workspaceId,
        targetUserId: req.params.userId,
      });
      return success(res, serializeWorkspaceMembership(updated));
    },

    /* =========================================================================
     * INVITATIONS
     * ====================================================================== */

    async listInvitations(req, res) {
      const invitations = await service.listInvitations({
        userId: req.auth.userId,
        workspaceId: req.params.workspaceId,
      });
      return success(res, invitations.map(serializeInvitation));
    },

    async inviteMember(req, res) {
      const result = await service.inviteMember({
        actorId: req.auth.userId,
        workspaceId: req.params.workspaceId,
        email: req.body.email,
        role: req.body.role,
        expiresInDays: req.body.expiresInDays,
      });
      return created(res, serializeInvitation(result.invitation));
    },

    async acceptInvitation(req, res) {
      const result = await service.acceptInvitation({
        userId: req.auth.userId,
        token: req.body.token,
      });
      return success(res, result);
    },

    async revokeInvitation(req, res) {
      const result = await service.revokeInvitation({
        actorId: req.auth.userId,
        workspaceId: req.params.workspaceId,
        invitationId: req.params.invitationId,
      });
      return success(res, result);
    },

    async resendInvitation(req, res) {
      const result = await service.resendInvitation({
        actorId: req.auth.userId,
        workspaceId: req.params.workspaceId,
        invitationId: req.params.invitationId,
      });
      return success(res, result);
    },

    /* =========================================================================
     * ROLES & PERMISSIONS
     * ====================================================================== */

    async listRoles(req, res) {
      const roles = await service.listRoles({
        userId: req.auth.userId,
        workspaceId: req.params.workspaceId,
      });
      return success(res, roles);
    },

    async getMyPermissions(req, res) {
      const permissions = await service.getEffectivePermissions({
        userId: req.auth.userId,
        workspaceId: req.params.workspaceId,
      });
      return success(res, { permissions });
    },

    /* =========================================================================
     * SHARE GRANTS
     * ====================================================================== */

    async listShareGrants(req, res) {
      const grants = await service.listShareGrantsForRecipient({
        userId: req.auth.userId,
        workspaceId: req.params.workspaceId,
      });
      return success(res, grants);
    },

    async createShareGrant(req, res) {
      const grant = await service.createShareGrant({
        userId: req.auth.userId,
        homeWorkspaceId: req.params.workspaceId,
        connectionId: req.body.connectionId,
        recipientWorkspaceId: req.body.recipientWorkspaceId,
        allowedOperations: req.body.allowedOperations,
        expiresAt: req.body.expiresAt,
      });
      return created(res, serializeConnectionShareGrant(grant));
    },

    async revokeShareGrant(req, res) {
      const revoked = await service.revokeShareGrant({
        userId: req.auth.userId,
        workspaceId: req.params.workspaceId,
        grantId: req.params.grantId,
      });
      return success(res, serializeConnectionShareGrant(revoked));
    },

    /* =========================================================================
     * OWNERSHIP
     * ====================================================================== */

    async initiateOwnershipTransfer(req, res) {
      const transfer = await service.initiateOwnershipTransfer({
        userId: req.auth.userId,
        workspaceId: req.params.workspaceId,
        newOwnerUserId: req.body.newOwnerUserId,
        reason: req.body.reason,
      });
      return created(res, transfer);
    },

    async acceptOwnershipTransfer(req, res) {
      const transfer = await service.acceptOwnershipTransfer({
        userId: req.auth.userId,
        transferId: req.params.transferId,
      });
      return success(res, transfer);
    },

    async cancelOwnershipTransfer(req, res) {
      const result = await service.cancelOwnershipTransfer({
        userId: req.auth.userId,
        transferId: req.params.transferId,
      });
      return success(res, result);
    },

    /* =========================================================================
     * AUDIT
     * ====================================================================== */

    async listAuditEvents(req, res) {
      const { rows, nextCursor } = await service.listAuditEvents({
        userId: req.auth.userId,
        workspaceId: req.params.workspaceId,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeAuditEvent), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },
  };
}

export default createWorkspacesController;