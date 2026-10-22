export const ROUTES = Object.freeze({
  public: {
    home: '/',
    features: '/features',
    pricing: '/pricing',
    about: '/about',
    contact: '/contact',
    faq: '/faq',
    privacy: '/privacy',
    terms: '/terms',
  },

  auth: {
    login: '/login',
    register: '/register',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
    verifyEmail: '/verify-email',
    mfa: '/mfa',
    mfaSetup: '/mfa/setup',
    accountRecovery: '/account-recovery',
  },

  onboarding: {
    welcome: '/onboarding',
    flow: '/onboarding/start',
    complete: '/onboarding/complete',
  },

  app: {
    dashboard: '/app/dashboard',

    terminal: {
      overview: '/app/terminal',
      spot: '/app/terminal/spot',
      futures: '/app/terminal/futures',
      orders: '/app/terminal/orders',
      order: (id = ':orderId') => `/app/terminal/orders/${id}`,
      positions: '/app/terminal/positions',
      trades: '/app/terminal/trades',
      executions: '/app/terminal/executions',
      execution: (id = ':executionId') => `/app/terminal/executions/${id}`,
    },

    connections: {
      overview: '/app/connections',
      create: '/app/connections/new',
      details: (id = ':connectionId') => `/app/connections/${id}`,
      accounts: (id = ':connectionId') => `/app/connections/${id}/accounts`,
      health: (id = ':connectionId') => `/app/connections/${id}/health`,
      instruments: (id = ':connectionId') => `/app/connections/${id}/instruments`,
      balances: (id = ':connectionId') => `/app/connections/${id}/balances`,
      rotate: (id = ':connectionId') => `/app/connections/${id}/rotate`,
    },

    synchronization: {
      overview: '/app/synchronization',
      create: '/app/synchronization/new',
      group: (id = ':groupId') => `/app/synchronization/${id}`,
      destinations: (id = ':groupId') => `/app/synchronization/${id}/destinations`,
      operations: (id = ':groupId') => `/app/synchronization/${id}/operations`,
      reconciliation: (id = ':groupId') => `/app/synchronization/${id}/reconciliation`,
      allOperations: '/app/synchronization/operations',
      operation: (id = ':operationId') => `/app/synchronization/operations/${id}`,
    },

    risk: {
      overview: '/app/risk',
      policies: '/app/risk/policies',
      createPolicy: '/app/risk/policies/new',
      policy: (id = ':policyId') => `/app/risk/policies/${id}`,
      policyVersions: (id = ':policyId') => `/app/risk/policies/${id}/versions`,
      exposure: '/app/risk/exposure',
      approvals: '/app/risk/approvals',
      incidents: '/app/risk/incidents',
      incident: (id = ':incidentId') => `/app/risk/incidents/${id}`,
      alerts: '/app/risk/alerts',
      emergency: '/app/risk/emergency',
    },

    sources: {
      overview: '/app/sources',
      create: '/app/sources/new',
      details: (id = ':sourceId') => `/app/sources/${id}`,
      connection: (id = ':sourceId') => `/app/sources/${id}/connection`,
      validation: (id = ':sourceId') => `/app/sources/${id}/validation`,
      health: (id = ':sourceId') => `/app/sources/${id}/health`,
      quality: (id = ':sourceId') => `/app/sources/${id}/quality`,
      sandbox: (id = ':sourceId') => `/app/sources/${id}/sandbox`,
      audit: (id = ':sourceId') => `/app/sources/${id}/audit`,
      discovery: '/app/sources/discovery',
      discoveryJob: (id = ':jobId') => `/app/sources/discovery/${id}`,
      reviewQueue: '/app/sources/review',
    },

    signals: {
      overview: '/app/signals',
      live: '/app/signals/live',
      details: (id = ':signalId') => `/app/signals/${id}`,
      messages: '/app/signals/messages',
      message: (id = ':messageId') => `/app/signals/messages/${id}`,
      reviewQueue: '/app/signals/review',
      intents: '/app/signals/intents',
      intent: (id = ':intentId') => `/app/signals/intents/${id}`,
    },

    marketplace: {
      browse: '/app/marketplace',
      traderProfile: '/app/marketplace/profile',
      provider: (id = ':providerId') => `/app/marketplace/providers/${id}`,
      providerSignals: (id = ':providerId') => `/app/marketplace/providers/${id}/signals`,
      providerPlans: (id = ':providerId') => `/app/marketplace/providers/${id}/plans`,
      providerPerformance: (id = ':providerId') =>
        `/app/marketplace/providers/${id}/performance`,
      providerDisclosures: (id = ':providerId') =>
        `/app/marketplace/providers/${id}/disclosures`,
      following: '/app/marketplace/following',
      subscriptions: '/app/marketplace/subscriptions',
      copyConfigurations: '/app/marketplace/copy-configurations',
      createCopyConfiguration: '/app/marketplace/copy-configurations/new',
      copyConfiguration: (id = ':configId') => `/app/marketplace/copy-configurations/${id}`,
      copyResults: '/app/marketplace/results',
    },

    trader: {
      overview: '/app/trader/dashboard',
      publishSignal: '/app/trader/signals/publish',
      signalHistory: '/app/trader/signals/history',
      subscribers: '/app/trader/subscribers',
      plans: '/app/trader/plans',
      revenue: '/app/trader/revenue',
      profile: '/app/trader/profile',
    },

    automation: {
      overview: '/app/automation',
      create: '/app/automation/new',
      workflow: (id = ':workflowId') => `/app/automation/${id}`,
      edit: (id = ':workflowId') => `/app/automation/${id}/edit`,
      versions: (id = ':workflowId') => `/app/automation/${id}/versions`,
      triggers: (id = ':workflowId') => `/app/automation/${id}/triggers`,
      schedules: (id = ':workflowId') => `/app/automation/${id}/schedules`,
      runs: (id = ':workflowId') => `/app/automation/${id}/runs`,
      tests: (id = ':workflowId') => `/app/automation/${id}/tests`,
      allRuns: '/app/automation/runs',
      run: (id = ':runId') => `/app/automation/runs/${id}`,
      templates: '/app/automation/templates',
    },

    simulation: {
      overview: '/app/simulation',
      environments: '/app/simulation/environments',
      createEnvironment: '/app/simulation/environments/new',
      environment: (id = ':environmentId') => `/app/simulation/environments/${id}`,
      runs: '/app/simulation/runs',
      run: (id = ':runId') => `/app/simulation/runs/${id}`,
      runReport: (id = ':runId') => `/app/simulation/runs/${id}/report`,
      runEvents: (id = ':runId') => `/app/simulation/runs/${id}/events`,
      replay: (id = ':replayId') => `/app/simulation/replays/${id}`,
      comparisons: '/app/simulation/comparisons',
      scenarios: '/app/simulation/scenarios',
    },

    referral: {
      dashboard: '/app/referral',
      enroll: '/app/referral/enroll',
      links: '/app/referral/links',
      createLink: '/app/referral/links/new',
      commissions: '/app/referral/commissions',
      ledger: '/app/referral/ledger',
      payouts: '/app/referral/payouts',
      payout: (id = ':payoutId') => `/app/referral/payouts/${id}`,
      newPayout: '/app/referral/payouts/new',
      statements: '/app/referral/statements',
      campaigns: '/app/referral/campaigns',
    },

    developer: {
      overview: '/app/developer',
      applications: '/app/developer/applications',
      createApplication: '/app/developer/applications/new',
      application: (id = ':applicationId') => `/app/developer/applications/${id}`,
      credentials: (id = ':applicationId') => `/app/developer/applications/${id}/credentials`,
      webhooks: (id = ':applicationId') => `/app/developer/applications/${id}/webhooks`,
      webhook: (appId = ':applicationId', id = ':subscriptionId') =>
        `/app/developer/applications/${appId}/webhooks/${id}`,
      usage: (id = ':applicationId') => `/app/developer/applications/${id}/usage`,
      sandbox: (id = ':applicationId') => `/app/developer/applications/${id}/sandbox`,
    },

    community: {
      overview: '/app/community',
      feed: '/app/community/feed',
      discover: '/app/community/discover',
      myProfile: '/app/community/profile',
      profile: (userId = ':userId') => `/app/community/profile/${userId}`,
      createPost: '/app/community/posts/new',
      post: (id = ':postId') => `/app/community/posts/${id}`,
      groups: '/app/community/groups',
      createGroup: '/app/community/groups/new',
      group: (id = ':groupId') => `/app/community/groups/${id}`,
      groupMembers: (id = ':groupId') => `/app/community/groups/${id}/members`,
      groupSettings: (id = ':groupId') => `/app/community/groups/${id}/settings`,
      groupThread: (id = ':groupId', threadId = ':threadId') =>
        `/app/community/groups/${id}/threads/${threadId}`,
      analysis: '/app/community/analysis',
      createAnalysis: '/app/community/analysis/new',
      analysisDoc: (id = ':documentId') => `/app/community/analysis/${id}`,
      analysisVersions: (id = ':documentId') => `/app/community/analysis/${id}/versions`,
      discussions: '/app/community/discussions',
      discussion: (threadId = ':threadId') => `/app/community/discussions/${threadId}`,
      messages: '/app/community/messages',
      messageConversation: (id = ':conversationId') => `/app/community/messages/${id}`,
      moderation: '/app/community/moderation',
      saved: '/app/community/saved',
      recommendations: '/app/community/recommendations',
    },

    billing: {
      overview: '/app/billing',
      plans: '/app/billing/plans',
      checkout: (checkoutId = ':checkoutId') => `/app/billing/checkout/${checkoutId}`,
      subscription: '/app/billing/subscription',
      invoices: '/app/billing/invoices',
      invoice: (id = ':invoiceId') => `/app/billing/invoices/${id}`,
      payments: '/app/billing/payments',
      refunds: '/app/billing/refunds',
      usage: '/app/billing/usage',
    },

    support: {
      overview: '/app/support',
      tickets: '/app/support/tickets',
      createTicket: '/app/support/tickets/new',
      ticket: (id = ':ticketId') => `/app/support/tickets/${id}`,
      help: '/app/support/help',
      helpArticle: (slug = ':slug') => `/app/support/help/${slug}`,
      feedback: '/app/support/feedback',
    },

    notifications: {
      overview: '/app/notifications',
      preferences: '/app/notifications/preferences',
      devices: '/app/notifications/devices',
    },

    settings: {
      overview: '/app/settings',
      profile: '/app/settings/profile',
      preferences: '/app/settings/preferences',
      trading: '/app/settings/trading',
      security: '/app/settings/security',
      sessions: '/app/settings/sessions',
      devices: '/app/settings/devices',
      notifications: '/app/settings/notifications',
      workspaces: '/app/settings/workspaces',
      workspaceNew: '/app/settings/workspaces/new',
      workspace: (id = ':workspaceId') => `/app/settings/workspaces/${id}`,
      workspaceMembers: (id = ':workspaceId') => `/app/settings/workspaces/${id}/members`,
      workspaceInvitations: (id = ':workspaceId') =>
        `/app/settings/workspaces/${id}/invitations`,
      workspaceRoles: (id = ':workspaceId') => `/app/settings/workspaces/${id}/roles`,
      workspaceShares: (id = ':workspaceId') =>
        `/app/settings/workspaces/${id}/connection-shares`,
      workspaceOwnership: (id = ':workspaceId') =>
        `/app/settings/workspaces/${id}/ownership`,
      workspaceAudit: (id = ':workspaceId') => `/app/settings/workspaces/${id}/audit`,
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