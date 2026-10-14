const env = import.meta.env;

function requireInProduction(value, name, fallback) {
  if (env.PROD && !value) {
    console.error(`[admin config] Missing required environment variable: ${name}`);
    return fallback ?? '';
  }
  return value ?? fallback ?? '';
}

export const apiConfig = Object.freeze({
  baseURL: requireInProduction(env.VITE_API_URL, 'VITE_API_URL', 'http://localhost:4000/api/v1'),
  appName: env.VITE_APP_NAME ?? 'SyncExc Admin',
  appURL: env.VITE_APP_URL ?? 'http://localhost:5174',
  environment: env.VITE_ENVIRONMENT ?? (env.DEV ? 'development' : 'production'),
  requireMfa: env.VITE_REQUIRE_MFA !== 'false',

  timeoutMs: 30_000,
  retry: {
    maxAttempts: 2,
    baseDelayMs: 500,
    maxDelayMs: 10_000,
  },

  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client-Name': 'syncexc-admin',
    'X-Client-Version': env.VITE_APP_VERSION ?? '1.0.0',
  },

  endpoints: {
    auth: {
      login: '/admin/auth/login',
      logout: '/admin/auth/logout',
      refresh: '/admin/auth/refresh',
      me: '/admin/auth/me',
      mfaVerify: '/admin/auth/mfa/verify',
      stepUp: '/admin/auth/step-up',
    },
    dashboard: {
      get: '/admin/dashboard',
      health: '/admin/health',
      incidents: '/admin/incidents',
    },
    users: {
      list: '/admin/users',
      detail: (id) => `/admin/users/${id}`,
      suspend: (id) => `/admin/users/${id}/suspend`,
      restore: (id) => `/admin/users/${id}/restore`,
      revokeSessions: (id) => `/admin/users/${id}/revoke-sessions`,
      audit: (id) => `/admin/users/${id}/audit`,
    },
    workspaces: {
      list: '/admin/workspaces',
      detail: (id) => `/admin/workspaces/${id}`,
      members: (id) => `/admin/workspaces/${id}/members`,
    },
    plans: {
      list: '/admin/plans',
      create: '/admin/plans',
      detail: (id) => `/admin/plans/${id}`,
      publish: (id) => `/admin/plans/${id}/publish`,
    },
    subscriptions: {
      list: '/admin/subscriptions',
      detail: (id) => `/admin/subscriptions/${id}`,
    },
    payments: {
      list: '/admin/payments',
      detail: (id) => `/admin/payments/${id}`,
      refundRequests: '/admin/payments/refund-requests',
    },
    refunds: {
      list: '/admin/refunds',
      approve: (id) => `/admin/refunds/${id}/approve`,
      reject: (id) => `/admin/refunds/${id}/reject`,
    },
    exchanges: {
      list: '/admin/exchanges',
      health: (id) => `/admin/exchanges/${id}/health`,
      capabilities: (id) => `/admin/exchanges/${id}/capabilities`,
      restrictions: (id) => `/admin/exchanges/${id}/restrictions`,
      healthChecks: (id) => `/admin/exchanges/${id}/health-checks`,
    },
    sourceDiscovery: {
      candidates: '/admin/source-discovery/candidates',
      candidate: (id) => `/admin/source-discovery/candidates/${id}`,
      decision: (id) => `/admin/source-discovery/candidates/${id}/decisions`,
    },
    signalSources: {
      list: '/admin/signal-sources',
      lifecycle: (id) => `/admin/signal-sources/${id}/lifecycle-actions`,
    },
    referrals: {
      policies: '/admin/referrals/policies',
      publishPolicy: (id) => `/admin/referrals/policies/${id}/publish`,
      commissions: '/admin/referrals/commissions',
      payouts: '/admin/referrals/payouts',
    },
    support: {
      queues: '/admin/support/queues',
      metrics: '/admin/support/metrics',
    },
    roles: {
      list: '/admin/roles',
      create: '/admin/roles',
      detail: (id) => `/admin/roles/${id}`,
    },
    permissions: {
      list: '/admin/permissions',
    },
    approvals: {
      list: '/admin/approvals',
      approve: (id) => `/admin/approvals/${id}/approve`,
      reject: (id) => `/admin/approvals/${id}/reject`,
    },
    audit: {
      list: '/admin/audit-events',
      detail: (id) => `/admin/audit-events/${id}`,
    },
    featureFlags: {
      list: '/admin/feature-flags',
      create: '/admin/feature-flags',
      detail: (id) => `/admin/feature-flags/${id}`,
      rollouts: (id) => `/admin/feature-flags/${id}/rollouts`,
      rollback: (id) => `/admin/feature-flags/${id}/rollback`,
    },
    alerts: {
      rules: '/admin/alert-rules',
      events: '/admin/alert-events',
    },
    operationJobs: {
      detail: (id) => `/admin/operation-jobs/${id}`,
    },
  },
});