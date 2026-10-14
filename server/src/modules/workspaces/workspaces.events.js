/**
 * SyncExc Server — Workspaces events
 */

export const WORKSPACES_EMITS = [
  'workspace.created',
  'workspace.updated',
  'workspace.member_role_changed',
  'workspace.member_suspended',
  'workspace.member_removed',
  'workspace.invitation_sent',
  'workspace.invitation_accepted',
  'workspace.ownership_transferred',
  'workspace.connection_share_granted',
  'workspace.connection_share_revoked',
];

export const WORKSPACES_CONSUMES = [];

export function registerWorkspacesEventHandlers({ events, service, logger }) {
  logger.debug(
    { emits: WORKSPACES_EMITS.length, consumes: WORKSPACES_CONSUMES.length },
    'Workspaces event handlers registered'
  );
}

export default registerWorkspacesEventHandlers;