/**
 * SyncExc Server — Workspaces routes
 */

import { Router } from 'express';
import Joi from 'joi';
import {
  CreateWorkspaceRequestSchema,
  UpdateWorkspaceRequestSchema,
  WorkspaceLifecycleRequestSchema,
  InviteMemberRequestSchema,
  UpdateMemberRoleRequestSchema,
  TransferOwnershipRequestSchema,
  CreateConnectionShareGrantSchema,
  PaginationSchema,
  UuidSchema,
} from '@syncexc/shared';
import { createWorkspacesController } from './workspaces.controller.js';

const AcceptInvitationSchema = Joi.object({
  token: Joi.string().min(32).max(256).required(),
});

export function createWorkspacesRoutes({ service, middleware }) {
  const controller = createWorkspacesController({ service });
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Workspaces
   * ------------------------------------------------------------------------ */
  router.get(
    '/',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.list)
  );

  router.post(
    '/',
    middleware.requireAuth(),
    middleware.validateBody(CreateWorkspaceRequestSchema),
    middleware.asyncHandler(controller.create)
  );

  router.get(
    '/:workspaceId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.get)
  );

  router.patch(
    '/:workspaceId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('workspace.update'),
    middleware.validateBody(UpdateWorkspaceRequestSchema),
    middleware.asyncHandler(controller.update)
  );

  router.patch(
    '/:workspaceId/lifecycle',
    middleware.requireAuth(),
    middleware.validateBody(WorkspaceLifecycleRequestSchema),
    middleware.asyncHandler(controller.updateLifecycle)
  );

  /* ---------------------------------------------------------------------------
   * Members
   * ------------------------------------------------------------------------ */
  router.get(
    '/:workspaceId/members',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('members.view'),
    middleware.asyncHandler(controller.listMembers)
  );

  router.patch(
    '/:workspaceId/members/:userId/role',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('members.role.update'),
    middleware.validateBody(UpdateMemberRoleRequestSchema),
    middleware.asyncHandler(controller.updateMemberRole)
  );

  router.post(
    '/:workspaceId/members/:userId/suspend',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('members.remove'),
    middleware.asyncHandler(controller.suspendMember)
  );

  router.delete(
    '/:workspaceId/members/:userId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('members.remove'),
    middleware.asyncHandler(controller.removeMember)
  );

  /* ---------------------------------------------------------------------------
   * Invitations
   * ------------------------------------------------------------------------ */
  router.get(
    '/:workspaceId/invitations',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('members.view'),
    middleware.asyncHandler(controller.listInvitations)
  );

  router.post(
    '/:workspaceId/invitations',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('members.invite'),
    middleware.validateBody(InviteMemberRequestSchema),
    middleware.asyncHandler(controller.inviteMember)
  );

  router.post(
    '/invitations/accept',
    middleware.requireAuth(),
    middleware.validateBody(AcceptInvitationSchema),
    middleware.asyncHandler(controller.acceptInvitation)
  );

  router.post(
    '/:workspaceId/invitations/:invitationId/resend',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('members.invite'),
    middleware.asyncHandler(controller.resendInvitation)
  );

  router.delete(
    '/:workspaceId/invitations/:invitationId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('members.invite'),
    middleware.asyncHandler(controller.revokeInvitation)
  );

  /* ---------------------------------------------------------------------------
   * Roles & permissions
   * ------------------------------------------------------------------------ */
  router.get(
    '/:workspaceId/roles',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listRoles)
  );

  router.get(
    '/:workspaceId/permissions/me',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getMyPermissions)
  );

  /* ---------------------------------------------------------------------------
   * Share grants
   * ------------------------------------------------------------------------ */
  router.get(
    '/:workspaceId/connection-shares',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.view'),
    middleware.asyncHandler(controller.listShareGrants)
  );

  router.post(
    '/:workspaceId/connection-shares',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.share'),
    middleware.validateBody(CreateConnectionShareGrantSchema),
    middleware.asyncHandler(controller.createShareGrant)
  );

  router.delete(
    '/:workspaceId/connection-shares/:grantId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.grants.revoke'),
    middleware.asyncHandler(controller.revokeShareGrant)
  );

  /* ---------------------------------------------------------------------------
   * Ownership
   * ------------------------------------------------------------------------ */
  router.post(
    '/:workspaceId/ownership-transfers',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requireStepUp(),
    middleware.validateBody(TransferOwnershipRequestSchema),
    middleware.asyncHandler(controller.initiateOwnershipTransfer)
  );

  router.post(
    '/ownership-transfers/:transferId/accept',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.acceptOwnershipTransfer)
  );

  router.post(
    '/ownership-transfers/:transferId/cancel',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.cancelOwnershipTransfer)
  );

  /* ---------------------------------------------------------------------------
   * Audit
   * ------------------------------------------------------------------------ */
  router.get(
    '/:workspaceId/audit-events',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('audit.view'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listAuditEvents)
  );

  return router;
}

export default createWorkspacesRoutes;