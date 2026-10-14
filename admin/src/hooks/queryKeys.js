export const queryKeys = {
  auth: {
    me: ['admin', 'auth', 'me'],
    mfaStatus: ['admin', 'auth', 'mfa', 'status'],
  },

  dashboard: {
    get: (params) => ['admin', 'dashboard', params],
    health: ['admin', 'health'],
    incidents: (params) => ['admin', 'incidents', params],
  },

  users: {
    list: (params) => ['admin', 'users', 'list', params],
    detail: (id) => ['admin', 'users', 'detail', id],
    audit: (id, params) => ['admin', 'users', 'audit', id, params],
  },

  workspaces: {
    list: (params) => ['admin', 'workspaces', 'list', params],
    detail: (id) => ['admin', 'workspaces', 'detail', id],
    members: (id, params) => ['admin', 'workspaces', 'members', id, params],
  },

  plans: {
    list: (params) => ['admin', 'plans', 'list', params],
    detail: (id) => ['admin', 'plans', 'detail', id],
  },

  subscriptions: {
    list: (params) => ['admin', 'subscriptions', 'list', params],
    detail: (id) => ['admin', 'subscriptions', 'detail', id],
  },

  payments: {
    list: (params) => ['admin', 'payments', 'list', params],
    detail: (id) => ['admin', 'payments', 'detail', id],
    refundRequests: (params) => ['admin', 'payments', 'refund-requests', params],
  },

  refunds: {
    list: (params) => ['admin', 'refunds', 'list', params],
  },

  exchanges: {
    list: (params) => ['admin', 'exchanges', 'list', params],
    health: (id) => ['admin', 'exchanges', 'health', id],
    capabilities: (id) => ['admin', 'exchanges', 'capabilities', id],
  },

  sourceDiscovery: {
    candidates: (params) => ['admin', 'source-discovery', 'candidates', params],
    candidate: (id) => ['admin', 'source-discovery', 'candidate', id],
  },

  signalSources: {
    list: (params) => ['admin', 'signal-sources', 'list', params],
  },

  referrals: {
    policies: (params) => ['admin', 'referrals', 'policies', params],
    commissions: (params) => ['admin', 'referrals', 'commissions', params],
    payouts: (params) => ['admin', 'referrals', 'payouts', params],
  },

  support: {
    queues: ['admin', 'support', 'queues'],
    metrics: (params) => ['admin', 'support', 'metrics', params],
  },

  roles: {
    list: (params) => ['admin', 'roles', 'list', params],
  },

  permissions: {
    list: ['admin', 'permissions', 'list'],
  },

  approvals: {
    list: (params) => ['admin', 'approvals', 'list', params],
  },

  audit: {
    list: (params) => ['admin', 'audit', 'list', params],
    detail: (id) => ['admin', 'audit', 'detail', id],
  },

  featureFlags: {
    list: (params) => ['admin', 'feature-flags', 'list', params],
    detail: (id) => ['admin', 'feature-flags', 'detail', id],
  },

  alerts: {
    rules: (params) => ['admin', 'alerts', 'rules', params],
    events: (params) => ['admin', 'alerts', 'events', params],
  },

  operationJobs: {
    detail: (id) => ['admin', 'operation-jobs', 'detail', id],
  },
};