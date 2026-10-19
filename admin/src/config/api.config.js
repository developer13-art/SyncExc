const env = import.meta.env;

function requireInProduction(value, name, fallback) {
  if (env.PROD && !value) {
    throw new Error(`[admin config] Missing required environment variable: ${name}`);
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
      login: '/auth/login',
      logout: '/auth/logout',
      refresh: '/auth/refresh',
      me: '/auth/me',
      mfaVerify: '/auth/mfa/verify',
      stepUp: '/auth/step-up',
    },
    dashboard: {
      get: '/dashboard',
      health: '/health',
      incidents: '/incidents',
    },
    users: {
      list: '/users',
      detail: (id) => `/users/${id}`,
      suspend: (id) => `/users/${id}/suspend`,
      restore: (id) => `/users/${id}/restore`,
      revokeSessions: (id) => `/users/${id}/revoke-sessions`,
      audit: (id) => `/users/${id}/audit`,
    },
    workspaces: {
      list: '/workspaces',
      detail: (id) => `/workspaces/${id}`,
      members: (id) => `/workspaces/${id}/members`,
    },
    plans: {
      list: '/plans',
      create: '/plans',
      detail: (id) => `/plans/${id}`,
      publish: (id) => `/plans/${id}/publish`,
    },
    subscriptions: {
      list: '/subscriptions',
      detail: (id) => `/subscriptions/${id}`,
    },
    payments: {
      list: '/payments',
      detail: (id) => `/payments/${id}`,
      refundRequests: '/payments/refund-requests',
    },
    refunds: {
      list: '/refunds',
      approve: (id) => `/refunds/${id}/approve`,
      reject: (id) => `/refunds/${id}/reject`,
    },
    exchanges: {
      list: '/exchanges',
      health: (id) => `/exchanges/${id}/health`,
      capabilities: (id) => `/exchanges/${id}/capabilities`,
      restrictions: (id) => `/exchanges/${id}/restrictions`,
      healthChecks: (id) => `/exchanges/${id}/health-checks`,
    },
    sourceDiscovery: {
      candidates: '/source-discovery/candidates',
      candidate: (id) => `/source-discovery/candidates/${id}`,
      decision: (id) => `/source-discovery/candidates/${id}/decisions`,
    },
    signalSources: {
      list: '/signal-sources',
      lifecycle: (id) => `/signal-sources/${id}/lifecycle-actions`,
    },
    referrals: {
      policies: '/referrals/policies',
      publishPolicy: (id) => `/referrals/policies/${id}/publish`,
      commissions: '/referrals/commissions',
      payouts: '/referrals/payouts',
    },
    support: {
      queues: '/support/queues',
      metrics: '/support/metrics',
    },
    roles: {
      list: '/roles',
      create: '/roles',
      detail: (id) => `/roles/${id}`,
    },
    permissions: {
      list: '/permissions',
    },
    approvals: {
      list: '/approvals',
      approve: (id) => `/approvals/${id}/approve`,
      reject: (id) => `/approvals/${id}/reject`,
    },
    audit: {
      list: '/audit-events',
      detail: (id) => `/audit-events/${id}`,
    },
    featureFlags: {
      list: '/feature-flags',
      create: '/feature-flags',
      detail: (id) => `/feature-flags/${id}`,
      rollouts: (id) => `/feature-flags/${id}/rollouts`,
      rollback: (id) => `/feature-flags/${id}/rollback`,
    },
    alerts: {
      rules: '/alert-rules',
      events: '/alert-events',
    },
    operationJobs: {
      detail: (id) => `/operation-jobs/${id}`,
    },
  },
});