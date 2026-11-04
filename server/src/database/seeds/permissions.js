/**
 * SyncExc Server — Seed: admin permissions and roles
 *
 * Populates `admin_permission_definitions` and `admin_role_definitions`, plus
 * the role-permission mappings for the default administrative profiles.
 */

const CONSOLE_SECTIONS = [
  ['dashboard', 'dashboard'],
  ['users', 'user management'],
  ['workspaces', 'workspace management'],
  ['exchanges', 'exchange management'],
  ['trading', 'trading operations'],
  ['synchronization', 'trade synchronization'],
  ['signal-sources', 'signal sources'],
  ['ai-signals', 'AI signal intelligence'],
  ['copy-trading', 'copy trading'],
  ['marketplace', 'marketplace management'],
  ['community', 'community management'],
  ['creators', 'creator and trader management'],
  ['trader-subscriptions', 'trader subscription management'],
  ['subscribers', 'subscriber management'],
  ['trader-earnings', 'trader earnings management'],
  ['payouts', 'payout management'],
  ['revenue', 'revenue and commission management'],
  ['campaigns', 'monetization campaigns'],
  ['subscription-operations', 'subscription operations'],
  ['platform-billing', 'platform billing'],
  ['financial-management', 'financial management'],
  ['disputes', 'refunds and financial disputes'],
  ['referrals', 'referral management'],
  ['support', 'support management'],
  ['communications', 'notifications and communications'],
  ['analytics', 'analytics and reports'],
  ['developer-api', 'developer API management'],
  ['risk', 'risk management'],
  ['incidents', 'incident management'],
  ['infrastructure', 'system infrastructure'],
  ['security', 'security management'],
  ['content-policy', 'content and policy management'],
  ['staff', 'admin and staff management'],
  ['settings', 'platform settings'],
];

const CONSOLE_PERMISSIONS = CONSOLE_SECTIONS.flatMap(([section, label]) => [
  {
    key: `admin.${section}.view`,
    category: section,
    description: `View ${label} pages and records`,
  },
  {
    key: `admin.${section}.manage`,
    category: section,
    description: `Manage ${label} records and actions`,
  },
]);

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
  { key: 'admin.marketplace.earnings.view', category: 'billing', description: 'View Trader marketplace earnings' },
  { key: 'admin.marketplace.earnings.manage', category: 'billing', description: 'Record manual Trader marketplace payouts' },
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
  { key: 'admin.referral.commissions.view', category: 'referral', description: 'View referral commission accruals' },
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

  // Admin console sections
  ...CONSOLE_PERMISSIONS,
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
      'admin.exchanges.manage',
      'admin.infrastructure.view',
      'admin.infrastructure.manage',
      'admin.incidents.view',
      'admin.incidents.manage',
      'admin.trading.view',
      'admin.synchronization.view',
      'admin.synchronization.manage',
      'admin.risk.view',
      'admin.risk.manage',
      'admin.signal-sources.view',
      'admin.analytics.view',
      'admin.security.view',
      'admin.content-policy.view',
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
      'admin.users.manage',
      'admin.workspaces.view',
      'admin.subscribers.view',
      'admin.trader-subscriptions.view',
      'admin.support.view',
      'admin.communications.view',
      'admin.community.view',
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
      'admin.analytics.view',
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
      'admin.marketplace.earnings.view',
      'admin.refunds.initiate',
      'admin.platform-billing.view',
      'admin.platform-billing.manage',
      'admin.trader-subscriptions.view',
      'admin.trader-subscriptions.manage',
      'admin.trader-earnings.view',
      'admin.payouts.view',
      'admin.revenue.view',
      'admin.disputes.view',
      'admin.subscription-operations.view',
      'admin.subscription-operations.manage',
      'admin.campaigns.view',
      'admin.financial-management.view',
      'admin.subscribers.view',
      'admin.analytics.view',
    ],
  },
  {
    name: 'financial_approver',
    description: 'Independent approval of configured refunds, adjustments, or payouts.',
    permissions: [
      'admin.payments.view',
      'admin.marketplace.earnings.view',
      'admin.marketplace.earnings.manage',
      'admin.refunds.approve',
      'admin.approvals.view',
      'admin.approvals.decide',
      'admin.payouts.manage',
      'admin.financial-management.manage',
      'admin.disputes.manage',
      'admin.revenue.view',
      'admin.platform-billing.view',
      'admin.subscription-operations.view',
      'admin.analytics.view',
    ],
  },
  {
    name: 'exchange_integration_operator',
    description: 'Adapter status, capability restrictions, and integration releases.',
    permissions: [
      'admin.exchanges.view',
      'admin.exchanges.restrict',
      'admin.exchanges.releases.manage',
      'admin.exchanges.manage',
      'admin.metrics.view',
      'admin.infrastructure.view',
      'admin.incidents.view',
      'admin.trading.view',
    ],
  },
  {
    name: 'source_reviewer',
    description: 'Discovery candidates, source validation, and review decisions.',
    permissions: [
      'admin.sources.review',
      'admin.sources.manage',
      'admin.signal-sources.view',
      'admin.signal-sources.manage',
      'admin.ai-signals.view',
      'admin.ai-signals.manage',
      'admin.copy-trading.view',
    ],
  },
  {
    name: 'referral_administrator',
    description: 'Referral policies, commission records, and payout oversight.',
    permissions: [
      'admin.referral.policies.manage',
      'admin.referral.commissions.view',
      'admin.referral.payouts.review',
      'admin.referral.fraud.review',
      'admin.payments.view',
      'admin.referrals.view',
      'admin.referrals.manage',
      'admin.payouts.view',
      'admin.financial-management.view',
      'admin.analytics.view',
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
      'admin.communications.view',
      'admin.communications.manage',
      'admin.community.view',
      'admin.community.manage',
      'admin.content-policy.view',
      'admin.subscribers.view',
      'admin.analytics.view',
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
      'admin.settings.view',
      'admin.infrastructure.view',
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
      'admin.security.view',
      'admin.security.manage',
      'admin.staff.view',
      'admin.infrastructure.view',
      'admin.analytics.view',
      'admin.settings.view',
      'admin.communications.view',
    ],
  },
  {
    name: 'audit_reviewer',
    description: 'Read-only audit access and compliance reporting.',
    permissions: [
      'admin.audit.view',
      'admin.audit.export',
      'admin.analytics.view',
      'admin.security.view',
      'admin.staff.view',
      'admin.financial-management.view',
      'admin.referrals.view',
      'admin.disputes.view',
    ],
  },
  {
    name: 'platform_administrator',
    description: 'Broad platform configuration within explicitly granted boundaries.',
    permissions: ['*'],
  },
];

export default { ADMIN_PERMISSIONS, DEFAULT_ADMIN_ROLES };