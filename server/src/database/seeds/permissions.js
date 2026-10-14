/**
 * SyncExc Server — Seed: admin permissions and roles
 *
 * Populates `admin_permission_definitions` and `admin_role_definitions`, plus
 * the role-permission mappings for the default administrative profiles.
 */

export const ADMIN_PERMISSIONS = [
  // Platform overview
  { key: 'admin.dashboard.view', category: 'overview', description: 'View the platform overview dashboard' },
  { key: 'admin.metrics.view', category: 'overview', description: 'View platform operational metrics' },
  { key: 'admin.alerts.manage', category: 'overview', description: 'Manage alert rules and events' },

  // Users
  { key: 'admin.users.view', category: 'users', description: 'View user records' },
  { key: 'admin.users.suspend', category: 'users', description: 'Suspend or restrict user accounts' },
  { key: 'admin.users.restore', category: 'users', description: 'Restore suspended user accounts' },
  { key: 'admin.users.sessions.revoke', category: 'users', description: 'Revoke user sessions' },
  { key: 'admin.users.mfa.reset', category: 'users', description: 'Reset MFA through verified recovery' },

  // Workspaces
  { key: 'admin.workspaces.view', category: 'workspaces', description: 'View workspace records' },
  { key: 'admin.workspaces.manage', category: 'workspaces', description: 'Manage workspace settings' },
  { key: 'admin.workspaces.shares.manage', category: 'workspaces', description: 'Review connection-sharing grants' },

  // Billing
  { key: 'admin.plans.view', category: 'billing', description: 'View subscription plans' },
  { key: 'admin.plans.manage', category: 'billing', description: 'Create and edit subscription plans' },
  { key: 'admin.subscriptions.view', category: 'billing', description: 'View subscriptions' },
  { key: 'admin.subscriptions.manage', category: 'billing', description: 'Manage subscription exceptions' },
  { key: 'admin.payments.view', category: 'billing', description: 'View payment records' },
  { key: 'admin.refunds.initiate', category: 'billing', description: 'Initiate refunds' },
  { key: 'admin.refunds.approve', category: 'billing', description: 'Approve refunds (separate from initiator)' },

  // Exchanges
  { key: 'admin.exchanges.view', category: 'exchanges', description: 'View exchange integrations' },
  { key: 'admin.exchanges.restrict', category: 'exchanges', description: 'Restrict exchange or capability' },
  { key: 'admin.exchanges.releases.manage', category: 'exchanges', description: 'Manage adapter releases' },

  // Sources
  { key: 'admin.sources.review', category: 'sources', description: 'Review discovered source candidates' },
  { key: 'admin.sources.manage', category: 'sources', description: 'Manage signal sources' },

  // Referral
  { key: 'admin.referral.policies.manage', category: 'referral', description: 'Manage referral policies' },
  { key: 'admin.referral.payouts.review', category: 'referral', description: 'Review payout requests' },
  { key: 'admin.referral.fraud.review', category: 'referral', description: 'Review fraud cases' },

  // Support
  { key: 'admin.support.view', category: 'support', description: 'View support queues and metrics' },
  { key: 'admin.support.manage', category: 'support', description: 'Manage support queues and escalation' },

  // Feature flags
  { key: 'admin.feature_flags.view', category: 'feature_flags', description: 'View feature flags' },
  { key: 'admin.feature_flags.manage', category: 'feature_flags', description: 'Create and edit feature flags' },
  { key: 'admin.feature_flags.rollout', category: 'feature_flags', description: 'Initiate rollouts' },
  { key: 'admin.feature_flags.rollback', category: 'feature_flags', description: 'Roll back rollouts' },

  // Roles & permissions
  { key: 'admin.roles.view', category: 'governance', description: 'View admin roles' },
  { key: 'admin.roles.manage', category: 'governance', description: 'Manage admin roles and assignments' },
  { key: 'admin.permissions.view', category: 'governance', description: 'View admin permissions' },

  // Approvals
  { key: 'admin.approvals.view', category: 'governance', description: 'View pending approvals' },
  { key: 'admin.approvals.decide', category: 'governance', description: 'Approve or reject protected actions' },

  // Audit
  { key: 'admin.audit.view', category: 'governance', description: 'View audit events' },
  { key: 'admin.audit.export', category: 'governance', description: 'Export audit events' },

  // Jobs & exports
  { key: 'admin.jobs.view', category: 'operations', description: 'View operation jobs' },
  { key: 'admin.jobs.manage', category: 'operations', description: 'Start and cancel operation jobs' },
  { key: 'admin.exports.create', category: 'operations', description: 'Create data exports' },

  // Sensitive data access
  { key: 'admin.data_access.sensitive', category: 'security', description: 'Access sensitive data under investigation' },
];

export const DEFAULT_ADMIN_ROLES = [
  {
    name: 'platform_operations',
    description: 'Service health, incidents, and approved operational controls.',
    permissions: [
      'admin.dashboard.view',
      'admin.metrics.view',
      'admin.alerts.manage',
      'admin.jobs.view',
      'admin.jobs.manage',
      'admin.feature_flags.view',
      'admin.feature_flags.manage',
      'admin.feature_flags.rollout',
      'admin.feature_flags.rollback',
      'admin.exchanges.view',
      'admin.exchanges.restrict',
    ],
  },
  {
    name: 'user_support_administrator',
    description: 'Account status and authorized recovery workflows.',
    permissions: [
      'admin.users.view',
      'admin.users.suspend',
      'admin.users.restore',
      'admin.users.sessions.revoke',
      'admin.users.mfa.reset',
      'admin.workspaces.view',
    ],
  },
  {
    name: 'workspace_administrator',
    description: 'Workspace records, memberships, and sharing governance.',
    permissions: [
      'admin.workspaces.view',
      'admin.workspaces.manage',
      'admin.workspaces.shares.manage',
      'admin.users.view',
    ],
  },
  {
    name: 'billing_administrator',
    description: 'Plans, subscriptions, payments, and financial exceptions.',
    permissions: [
      'admin.plans.view',
      'admin.plans.manage',
      'admin.subscriptions.view',
      'admin.subscriptions.manage',
      'admin.payments.view',
      'admin.refunds.initiate',
    ],
  },
  {
    name: 'financial_approver',
    description: 'Independent approval of configured refunds, adjustments, or payouts.',
    permissions: [
      'admin.payments.view',
      'admin.refunds.approve',
      'admin.approvals.view',
      'admin.approvals.decide',
    ],
  },
  {
    name: 'exchange_integration_operator',
    description: 'Adapter status, capability restrictions, and integration releases.',
    permissions: [
      'admin.exchanges.view',
      'admin.exchanges.restrict',
      'admin.exchanges.releases.manage',
      'admin.metrics.view',
    ],
  },
  {
    name: 'source_reviewer',
    description: 'Discovery candidates, source validation, and review decisions.',
    permissions: ['admin.sources.review', 'admin.sources.manage'],
  },
  {
    name: 'referral_administrator',
    description: 'Referral policies, commission records, and payout oversight.',
    permissions: [
      'admin.referral.policies.manage',
      'admin.referral.payouts.review',
      'admin.referral.fraud.review',
      'admin.payments.view',
    ],
  },
  {
    name: 'support_operations_manager',
    description: 'Queues, escalation rules, knowledge base, and service metrics.',
    permissions: [
      'admin.support.view',
      'admin.support.manage',
      'admin.users.view',
      'admin.workspaces.view',
    ],
  },
  {
    name: 'feature_release_manager',
    description: 'Feature flags, staged rollouts, and rollback controls.',
    permissions: [
      'admin.feature_flags.view',
      'admin.feature_flags.manage',
      'admin.feature_flags.rollout',
      'admin.feature_flags.rollback',
    ],
  },
  {
    name: 'security_administrator',
    description: 'Security events, incident response, and tightly scoped access controls.',
    permissions: [
      'admin.users.view',
      'admin.users.suspend',
      'admin.users.sessions.revoke',
      'admin.audit.view',
      'admin.audit.export',
      'admin.data_access.sensitive',
      'admin.approvals.view',
      'admin.approvals.decide',
    ],
  },
  {
    name: 'audit_reviewer',
    description: 'Read-only audit access and compliance reporting.',
    permissions: ['admin.audit.view', 'admin.audit.export'],
  },
  {
    name: 'platform_administrator',
    description: 'Broad platform configuration within explicitly granted boundaries.',
    permissions: ['*'],
  },
];

export default { ADMIN_PERMISSIONS, DEFAULT_ADMIN_ROLES };