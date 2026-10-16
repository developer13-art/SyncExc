/**
 * SyncExc Server — Seed: default subscription plans
 *
 * Three starter plans: Free, Pro, Business. These seed the plan catalog with
 * placeholder pricing that can be edited in the admin console. Every plan
 * version is published immediately so the client has something to render.
 */

export const DEFAULT_PLANS = [
  {
    code: 'FREE',
    name: 'Free',
    description: 'For individuals exploring SyncExc.',
    status: 'active',
    version: {
      features: {
        'automation.enabled': false,
        'simulation.enabled': false,
        'developerApi.enabled': false,
        'marketplace.enabled': true,
        'referral.enabled': true,
        'community.enabled': true,
      },
      limits: {
        'exchangeConnections.max': 1,
        'signalSources.max': 3,
        'traderWorkspaces.max': 1,
        'developerWorkspaces.max': 1,
        'workflows.max': 0,
        'simulations.max': 0,
        'workspaceMembers.max': 1,
        'apiRequests.monthly': 0,
        'notifications.monthly': 500,
      },
      availability: {},
    },
    prices: [
      { currency: 'USD', amountMinor: 0, billingInterval: 'monthly' },
    ],
  },
  {
    code: 'PRO',
    name: 'Pro',
    description: 'For active traders using multiple exchanges.',
    status: 'active',
    version: {
      features: {
        'automation.enabled': true,
        'simulation.enabled': true,
        'developerApi.enabled': true,
        'marketplace.enabled': true,
        'referral.enabled': true,
        'community.enabled': true,
      },
      limits: {
        'exchangeConnections.max': 5,
        'signalSources.max': 25,
        'traderWorkspaces.max': 5,
        'developerWorkspaces.max': 5,
        'workflows.max': 10,
        'simulations.max': 50,
        'workspaceMembers.max': 5,
        'apiRequests.monthly': 100000,
        'notifications.monthly': 5000,
      },
      availability: {},
    },
    prices: [
      { currency: 'USD', amountMinor: 2900, billingInterval: 'monthly' },
      { currency: 'USD', amountMinor: 29000, billingInterval: 'yearly' },
    ],
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    description: 'For trading teams and organizations.',
    status: 'active',
    version: {
      features: {
        'automation.enabled': true,
        'simulation.enabled': true,
        'developerApi.enabled': true,
        'marketplace.enabled': true,
        'referral.enabled': true,
        'community.enabled': true,
      },
      limits: {
        'exchangeConnections.max': 25,
        'signalSources.max': 100,
        'traderWorkspaces.max': 25,
        'developerWorkspaces.max': 25,
        'workflows.max': 100,
        'simulations.max': 500,
        'workspaceMembers.max': 25,
        'apiRequests.monthly': 1000000,
        'notifications.monthly': 50000,
      },
      availability: {},
    },
    prices: [
      { currency: 'USD', amountMinor: 9900, billingInterval: 'monthly' },
      { currency: 'USD', amountMinor: 99000, billingInterval: 'yearly' },
    ],
  },
];

export default DEFAULT_PLANS;