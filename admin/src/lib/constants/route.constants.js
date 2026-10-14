export const ADMIN_NAV_SECTIONS = Object.freeze([
  {
    id: 'operational',
    label: 'Operational',
    items: [
      { id: 'overview', label: 'Overview', path: '/overview', icon: 'dashboard' },
      { id: 'alerts', label: 'Alerts', path: '/alerts/events', icon: 'notifications' },
      {
        id: 'operationJobs',
        label: 'Operation jobs',
        path: '/operation-jobs',
        icon: 'automation',
      },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    items: [
      { id: 'users', label: 'Users', path: '/users', icon: 'community' },
      { id: 'workspaces', label: 'Workspaces', path: '/workspaces', icon: 'workspaces' },
      { id: 'support', label: 'Support', path: '/support', icon: 'support' },
    ],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    items: [
      { id: 'plans', label: 'Plans', path: '/plans', icon: 'billing' },
      { id: 'subscriptions', label: 'Subscriptions', path: '/subscriptions', icon: 'billing' },
      { id: 'payments', label: 'Payments', path: '/payments', icon: 'billing' },
      { id: 'refunds', label: 'Refunds', path: '/refunds', icon: 'billing' },
      { id: 'referrals', label: 'Referrals', path: '/referrals', icon: 'referral' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    items: [
      { id: 'exchanges', label: 'Exchanges', path: '/exchanges', icon: 'connections' },
      {
        id: 'sourceDiscovery',
        label: 'Source discovery',
        path: '/source-discovery',
        icon: 'sources',
      },
      {
        id: 'signalSources',
        label: 'Signal sources',
        path: '/signal-sources',
        icon: 'signals',
      },
    ],
  },
  {
    id: 'governance',
    label: 'Governance',
    items: [
      { id: 'roles', label: 'Roles & permissions', path: '/roles', icon: 'settings' },
      { id: 'approvals', label: 'Approvals', path: '/approvals', icon: 'risk' },
      { id: 'audit', label: 'Audit history', path: '/audit', icon: 'settings' },
      {
        id: 'featureFlags',
        label: 'Feature flags',
        path: '/feature-flags',
        icon: 'automation',
      },
    ],
  },
]);