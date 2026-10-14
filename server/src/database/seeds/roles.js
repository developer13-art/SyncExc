/**
 * SyncExc Server — Seed: default workspace roles
 *
 * Every new workspace gets these roles created via the workspace-creation
 * service. The seed script also applies them to any existing workspaces
 * missing them.
 *
 * System roles cannot be renamed or deleted by workspace owners.
 */

import { PERMISSION } from '@syncexc/shared';

export const DEFAULT_WORKSPACE_ROLES = [
  {
    name: 'owner',
    description: 'Full authority over the workspace, subject to platform-wide controls.',
    permissions: Object.values(PERMISSION),
    isSystem: true,
  },
  {
    name: 'administrator',
    description:
      'Manages workspace settings, membership, roles, and operational configuration.',
    permissions: [
      PERMISSION.WORKSPACE_VIEW,
      PERMISSION.WORKSPACE_UPDATE,
      PERMISSION.MEMBERS_VIEW,
      PERMISSION.MEMBERS_INVITE,
      PERMISSION.MEMBERS_REMOVE,
      PERMISSION.MEMBERS_ROLE_UPDATE,
      PERMISSION.CONNECTIONS_VIEW,
      PERMISSION.CONNECTIONS_CREATE,
      PERMISSION.CONNECTIONS_UPDATE,
      PERMISSION.CONNECTIONS_DISCONNECT,
      PERMISSION.CONNECTIONS_SHARE,
      PERMISSION.CONNECTIONS_GRANTS_MANAGE,
      PERMISSION.CONNECTIONS_GRANTS_REVOKE,
      PERMISSION.STRATEGIES_VIEW,
      PERMISSION.STRATEGIES_CREATE,
      PERMISSION.STRATEGIES_UPDATE,
      PERMISSION.STRATEGIES_ARCHIVE,
      PERMISSION.SYNC_VIEW,
      PERMISSION.SYNC_CONFIGURE,
      PERMISSION.SYNC_PAUSE,
      PERMISSION.SYNC_RESUME,
      PERMISSION.TRADING_MONITOR,
      PERMISSION.TRADING_REQUEST_EXECUTION,
      PERMISSION.TRADING_APPROVE_EXECUTION,
      PERMISSION.TRADING_MANAGE_AUTOMATION,
      PERMISSION.RISK_VIEW,
      PERMISSION.RISK_CONFIGURE,
      PERMISSION.REPORTS_VIEW,
      PERMISSION.REPORTS_EXPORT,
      PERMISSION.AUDIT_VIEW,
      PERMISSION.BILLING_VIEW,
    ],
    isSystem: true,
  },
  {
    name: 'trading_operator',
    description:
      'Manages authorized trading configurations and may initiate or control execution when granted.',
    permissions: [
      PERMISSION.WORKSPACE_VIEW,
      PERMISSION.MEMBERS_VIEW,
      PERMISSION.CONNECTIONS_VIEW,
      PERMISSION.CONNECTIONS_UPDATE,
      PERMISSION.STRATEGIES_VIEW,
      PERMISSION.STRATEGIES_CREATE,
      PERMISSION.STRATEGIES_UPDATE,
      PERMISSION.SYNC_VIEW,
      PERMISSION.SYNC_CONFIGURE,
      PERMISSION.SYNC_PAUSE,
      PERMISSION.SYNC_RESUME,
      PERMISSION.TRADING_MONITOR,
      PERMISSION.TRADING_REQUEST_EXECUTION,
      PERMISSION.TRADING_MANAGE_AUTOMATION,
      PERMISSION.RISK_VIEW,
      PERMISSION.REPORTS_VIEW,
    ],
    isSystem: true,
  },
  {
    name: 'analyst',
    description:
      'Views permitted market data, trading configurations, synchronization status and performance records.',
    permissions: [
      PERMISSION.WORKSPACE_VIEW,
      PERMISSION.MEMBERS_VIEW,
      PERMISSION.CONNECTIONS_VIEW,
      PERMISSION.STRATEGIES_VIEW,
      PERMISSION.SYNC_VIEW,
      PERMISSION.TRADING_MONITOR,
      PERMISSION.RISK_VIEW,
      PERMISSION.REPORTS_VIEW,
      PERMISSION.REPORTS_EXPORT,
    ],
    isSystem: true,
  },
  {
    name: 'viewer',
    description: 'Read-only access to explicitly authorized workspace resources.',
    permissions: [
      PERMISSION.WORKSPACE_VIEW,
      PERMISSION.CONNECTIONS_VIEW,
      PERMISSION.STRATEGIES_VIEW,
      PERMISSION.SYNC_VIEW,
      PERMISSION.TRADING_MONITOR,
      PERMISSION.REPORTS_VIEW,
    ],
    isSystem: true,
  },
];

export default DEFAULT_WORKSPACE_ROLES;