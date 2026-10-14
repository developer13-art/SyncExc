export const ROUTES = Object.freeze({
  auth: {
    login: '/login',
    mfa: '/mfa',
  },

  console: {
    overview: '/overview',

    users: {
      overview: '/users',
      details: (id = ':userId') => `/users/${id}`,
    },

    workspaces: {
      overview: '/workspaces',
      details: (id = ':workspaceId') => `/workspaces/${id}`,
    },

    plans: {
      overview: '/plans',
      create: '/plans/new',
      details: (id = ':planId') => `/plans/${id}`,
    },

    subscriptions: {
      overview: '/subscriptions',
      details: (id = ':subscriptionId') => `/subscriptions/${id}`,
    },

    payments: {
      overview: '/payments',
      details: (id = ':paymentId') => `/payments/${id}`,
    },

    refunds: {
      overview: '/refunds',
      details: (id = ':refundId') => `/refunds/${id}`,
    },

    exchanges: {
      overview: '/exchanges',
      details: (id = ':exchangeId') => `/exchanges/${id}`,
    },

    sourceDiscovery: {
      candidates: '/source-discovery',
      candidate: (id = ':candidateId') => `/source-discovery/${id}`,
    },

    signalSources: {
      overview: '/signal-sources',
      details: (id = ':sourceId') => `/signal-sources/${id}`,
    },

    referrals: {
      overview: '/referrals',
      policies: '/referrals/policies',
      payouts: '/referrals/payouts',
      fraudCases: '/referrals/fraud-cases',
    },

    support: {
      overview: '/support',
      queues: '/support/queues',
    },

    featureFlags: {
      overview: '/feature-flags',
      create: '/feature-flags/new',
      details: (id = ':flagId') => `/feature-flags/${id}`,
      versions: (id = ':flagId') => `/feature-flags/${id}/versions`,
      rollouts: (id = ':flagId') => `/feature-flags/${id}/rollouts`,
    },

    roles: {
      overview: '/roles',
    },

    approvals: {
      overview: '/approvals',
    },

    audit: {
      overview: '/audit',
      details: (id = ':eventId') => `/audit/${id}`,
    },

    alerts: {
      rules: '/alerts/rules',
      events: '/alerts/events',
    },

    operationJobs: {
      overview: '/operation-jobs',
      details: (id = ':jobId') => `/operation-jobs/${id}`,
    },
  },

  notFound: '*',
});

export function buildPath(template, params = {}) {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(String(value))),
    template,
  );
}