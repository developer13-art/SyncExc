import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const workspacesApi = {
  list: (params) => api.getPaged(endpoints.workspaces.list, { params }),

  create: (payload) => api.post(endpoints.workspaces.create, payload),

  getById: (workspaceId) => api.get(endpoints.workspaces.detail(workspaceId)),

  update: (workspaceId, payload) => api.patch(endpoints.workspaces.detail(workspaceId), payload),

  listMembers: (workspaceId, params) =>
    api.getPaged(endpoints.workspaces.members(workspaceId), { params }),

  updateMemberRole: (workspaceId, userId, payload) =>
    api.patch(endpoints.workspaces.member(workspaceId, userId), payload),

  suspendMember: (workspaceId, userId) =>
    api.post(`${endpoints.workspaces.member(workspaceId, userId)}/suspend`),

  restoreMember: (workspaceId, userId) =>
    api.post(`${endpoints.workspaces.member(workspaceId, userId)}/restore`),

  removeMember: (workspaceId, userId) =>
    api.delete(endpoints.workspaces.member(workspaceId, userId)),

  listInvitations: (workspaceId, params) =>
    api.getPaged(endpoints.workspaces.invitations(workspaceId), { params }),

  createInvitation: (workspaceId, payload) =>
    api.post(endpoints.workspaces.invitations(workspaceId), payload),

  resendInvitation: (workspaceId, invitationId) =>
    api.post(`${endpoints.workspaces.invitations(workspaceId)}/${invitationId}/resend`),

  revokeInvitation: (workspaceId, invitationId) =>
    api.delete(`${endpoints.workspaces.invitations(workspaceId)}/${invitationId}`),

  acceptInvitation: (token) => api.post(endpoints.workspaces.acceptInvitation(token)),

  listRoles: (workspaceId) => api.get(endpoints.workspaces.roles(workspaceId)),

  createRole: (workspaceId, payload) =>
    api.post(endpoints.workspaces.roles(workspaceId), payload),

  updateRole: (workspaceId, roleId, payload) =>
    api.patch(`${endpoints.workspaces.roles(workspaceId)}/${roleId}`, payload),

  deleteRole: (workspaceId, roleId) =>
    api.delete(`${endpoints.workspaces.roles(workspaceId)}/${roleId}`),

  getMyPermissions: (workspaceId) => api.get(endpoints.workspaces.permissions(workspaceId)),

  listConnectionShares: (workspaceId, params) =>
    api.getPaged(endpoints.workspaces.shares(workspaceId), { params }),

  createConnectionShare: (workspaceId, payload) =>
    api.post(endpoints.workspaces.shares(workspaceId), payload),

  updateConnectionShare: (workspaceId, grantId, payload) =>
    api.patch(endpoints.workspaces.share(workspaceId, grantId), payload),

  revokeConnectionShare: (workspaceId, grantId) =>
    api.delete(endpoints.workspaces.share(workspaceId, grantId)),

  initiateOwnershipTransfer: (workspaceId, payload) =>
    api.post(endpoints.workspaces.ownershipTransfer(workspaceId), payload),

  acceptOwnershipTransfer: (transferId) =>
    api.post(endpoints.workspaces.ownershipAccept(transferId)),

  cancelOwnershipTransfer: (transferId) =>
    api.post(`${endpoints.workspaces.ownershipAccept(transferId)}/cancel`),

  getAuditEvents: (workspaceId, params) =>
    api.getPaged(endpoints.workspaces.audit(workspaceId), { params }),

  switchContext: (workspaceId) =>
    api.post(`${endpoints.workspaces.detail(workspaceId)}/switch-context`),
};