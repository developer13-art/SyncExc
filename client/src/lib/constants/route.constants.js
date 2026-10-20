export const NAV_SECTIONS = Object.freeze([
  {
    id: 'trading',
    label: 'Trading',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/app/dashboard', icon: 'dashboard' },
      { id: 'terminal', label: 'Terminal', path: '/app/terminal', icon: 'terminal' },
      {
        id: 'connections',
        label: 'Connections',
        path: '/app/connections',
        icon: 'connections',
      },
      {
        id: 'synchronization',
        label: 'Synchronization',
        path: '/app/synchronization',
        icon: 'sync',
      },
      { id: 'risk', label: 'Risk', path: '/app/risk', icon: 'risk' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      { id: 'sources', label: 'Signal Sources', path: '/app/sources', icon: 'sources' },
      { id: 'signals', label: 'Signals', path: '/app/signals', icon: 'signals' },
      {
        id: 'marketplace',
        label: 'Marketplace',
        path: '/app/marketplace',
        icon: 'marketplace',
      },
      {
        id: 'trader-studio',
        label: 'Trader Studio',
        path: '/app/marketplace/profile',
        icon: 'marketplace',
      },
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    items: [
      { id: 'automation', label: 'Workflows', path: '/app/automation', icon: 'automation' },
      { id: 'simulation', label: 'Simulation', path: '/app/simulation', icon: 'simulation' },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { id: 'developer', label: 'Developer', path: '/app/developer', icon: 'developer' },
      { id: 'community', label: 'Community', path: '/app/community', icon: 'community' },
      { id: 'referral', label: 'Referral', path: '/app/referral', icon: 'referral' },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'billing', label: 'Billing', path: '/app/billing', icon: 'billing' },
      { id: 'support', label: 'Support', path: '/app/support', icon: 'support' },
      {
        id: 'notifications',
        label: 'Notifications',
        path: '/app/notifications',
        icon: 'notifications',
      },
      { id: 'settings', label: 'Settings', path: '/app/settings', icon: 'settings' },
    ],
  },
  {
    id: 'trader-account',
    label: 'Account',
    items: [
      { id: 'trader-settings', label: 'Settings', path: '/app/settings', icon: 'settings' },
    ],
  },
]);

export const TRADER_NAV_SECTIONS = Object.freeze([
  {
    id: 'trader',
    label: 'Trader workspace',
    items: [
      { id: 'trader-dashboard', label: 'Dashboard', path: '/app/trader/dashboard', icon: 'dashboard' },
      { id: 'trader-publish', label: 'Publish signal', path: '/app/trader/signals/publish', icon: 'signals' },
      { id: 'trader-history', label: 'Signal history', path: '/app/trader/signals/history', icon: 'terminal' },
      { id: 'trader-subscribers', label: 'Subscribers', path: '/app/trader/subscribers', icon: 'connections' },
      { id: 'trader-plans', label: 'Subscription plans', path: '/app/trader/plans', icon: 'billing' },
      { id: 'trader-revenue', label: 'Revenue & payouts', path: '/app/trader/revenue', icon: 'billing' },
      { id: 'trader-profile', label: 'Public profile', path: '/app/trader/profile', icon: 'marketplace' },
      { id: 'trader-marketplace', label: 'Marketplace', path: '/app/marketplace', icon: 'marketplace' },
    ],
  },
]);

export const PUBLIC_LINKS = Object.freeze([
  { label: 'Features', path: '/features' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'About', path: '/about' },
  { label: 'Contact', path: '/contact' },
]);

export const FOOTER_LINKS = Object.freeze({
  product: [
    { label: 'Features', path: '/features' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'FAQ', path: '/faq' },
  ],
  legal: [
    { label: 'Privacy Policy', path: '/privacy' },
    { label: 'Terms of Service', path: '/terms' },
  ],
  company: [
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ],
});