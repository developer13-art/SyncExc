const SECTION_DEFINITIONS = [
  ['dashboard', 'Dashboard', 'Admin Overview|Platform Analytics|Live Activity|System Health|Operational Alerts|Quick Actions|Operation Jobs|Approvals|Alert Rules|Audit Log'],
  ['users', 'User Management', 'All Users|Active Users|Suspended Users|Pending Accounts|User Details|User Activity|User Login History|User Security History|User Workspaces|User Subscriptions|User Reports'],
  ['workspaces', 'Workspace Management', 'All Workspaces|Personal Workspaces|Trader Workspaces|Developer Workspaces|Public Workspaces|Suspended Workspaces|Workspace Details|Workspace Members|Workspace Permissions|Workspace Connections|Workspace Activity|Workspace Billing'],
  ['exchanges', 'Exchange Management', 'Exchange Overview|Exchange Directory|Exchange Details|API Health|API Errors|Rate Limits|Markets and Symbols|Trading Rules|Exchange Maintenance|Integration Logs'],
  ['trading', 'Trading Operations', 'Trading Overview|All Trades|Open Positions|Closed Positions|Pending Orders|Failed Orders|Rejected Orders|Cancelled Orders|Trade Details|Execution Timeline|Order Reconciliation|Execution Errors|Trading Risk Events'],
  ['synchronization', 'Trade Synchronization', 'Synchronization Overview|All Synchronization Groups|Active Groups|Paused Groups|Failed Groups|Group Details|Synchronization History|Pending Synchronizations|Failed Synchronizations|Reconciliation|Sync Engine Health|Synchronization Rules|Circuit-Breaker Events'],
  ['official-trader', 'Official AI Trader', 'Overview|Exchange Accounts|AI Research|Analysis Management|Execution Management|Performance|Marketplace Management|Subscribers|Copy Operations|Risk Management|Settings'],
  ['signal-sources', 'Signal Sources', 'Signal Overview|All Signal Sources|Telegram Connections|WhatsApp Connections|Other Integrations|Source Details|Selected Channels and Groups|Signal Reception History|Failed Connections|Source Health|Integration Logs|Source Discovery'],
  ['ai-signals', 'AI Signal Intelligence', 'AI Overview|Parsed Signals|Unparsed Signals|Rejected Signals|Signal Confidence Monitoring|AI Model Management|Prompt Management|Parsing Rules|Symbol Recognition|Trade Parameter Extraction|Parsing Test Laboratory|AI Processing Logs|AI Performance Analytics'],
  ['copy-trading', 'Copy Trading', 'Copy Trading Overview|All Copy Relationships|Active Relationships|Paused Relationships|Stopped Relationships|Failed Relationships|Copy Trading History|Trader Performance|Follower Activity|Copy Execution Logs|Copy Configuration|Copy Risk Incidents'],
  ['marketplace', 'Marketplace Management', 'Marketplace Overview|Trader Directory|Trader Details|Strategy Listings|Strategy Details|Signal Providers|Provider Details|Marketplace Categories|Featured Traders|Featured Listings|Reported Listings|Marketplace Reviews|Marketplace Settings'],
  ['community', 'Community Management', 'Community Overview|All Posts|Trading Discussions|Announcements|Tips and Guides|Events|Comments|Reported Content|Community Members|Community Leaderboard|Trending Topics|Community Categories|Community Settings'],
  ['creators', 'Creator and Trader Management', 'Creator Overview|All Creators|Pending Creator Applications|Approved Creators|Restricted Creators|Suspended Creators|Creator Profiles|Creator Eligibility|Creator Verification Records|Creator Performance|Creator Violations|Monetization Permissions'],
  ['trader-subscriptions', 'Trader Subscription Management', 'Trader Subscription Overview|All Trader Plans|Create Subscription Plan|Subscription Plan Details|Active Plans|Inactive Plans|All Subscribers|Subscriber Details|Active Subscriptions|Cancelled Subscriptions|Expired Subscriptions|Failed Subscriptions|Subscription Transactions|Subscription Disputes|Subscription Settings'],
  ['subscribers', 'Subscriber Management', 'Subscriber Overview|All Subscribers|Subscriber Details|Trader Subscriber Directory|Subscription Entitlements|Active Access|Expired Access|Suspended Access|Cancelled Access|Access History|Entitlement Disputes'],
  ['trader-earnings', 'Trader Earnings Management', 'Earnings Overview|All Trader Earnings|Earnings by Trader|Earnings by Revenue Source|Pending Earnings|Available Earnings|On-Hold Earnings|Settled Earnings|Reversed Earnings|Platform Commission Records|Revenue-Sharing Records|Earnings Adjustments|Earnings Statements'],
  ['payouts', 'Payout Management', 'Payout Overview|All Payout Requests|Pending Payouts|Payouts Under Review|Approved Payouts|Processing Payouts|Completed Payouts|Failed Payouts|Rejected Payouts|Reversed Payouts|Payout Details|Payout Methods|Payout Settings|Settlement History'],
  ['revenue', 'Revenue and Commission Management', 'Revenue Overview|Revenue by Product|Revenue by Trader|Revenue by Subscription|Revenue by Country|Platform Commission Rules|Commission History|Commission Adjustments|Revenue Sharing|Financial Reconciliation'],
  ['campaigns', 'Monetization Campaigns', 'Campaign Overview|All Campaigns|Create Campaign|Trader Promotions|Discount Codes|Limited-Time Offers|Subscription Offers|Campaign Performance|Campaign Approvals|Campaign Settings'],
  ['subscription-operations', 'Subscription Operations', 'Subscription Operations Overview|Automatic Renewals|Renewal Reminders|Payment Retry Management|Grace Period Management|Subscription Pauses|Cancellation Management|Upgrade and Downgrade Management|Expiry Management|Subscription Recovery Analytics'],
  ['platform-billing', 'Platform Billing', 'Billing Overview|Subscription Plans|All Subscriptions|Active Subscriptions|Expired Subscriptions|Cancelled Subscriptions|Failed Payments|Payment History|Payment Details|Invoices|Regional Pricing|Discounts|Feature Entitlements|Billing Settings'],
  ['financial-management', 'Financial Management', 'Financial Overview|Master Ledger|Customer Payments|Trader Earnings Ledger|Platform Commission Ledger|Referral Commission Ledger|Payout Ledger|Refund Ledger|Chargeback Ledger|Provider Settlement Records|Reconciliation Reports|Financial Adjustments|Period Closing Reports'],
  ['disputes', 'Refunds and Financial Disputes', 'Financial Disputes Overview|All Refunds|Refund Requests|Approved Refunds|Rejected Refunds|Chargebacks|Payment Disputes|Subscription Disputes|Trader Disputes|Financial Investigations|Refund History'],
  ['referrals', 'Referral Management', 'Referral Overview|All Referral Users|Referral Relationships|Referral Attribution|Commission Records|Pending Commissions|Approved Commissions|Paid Commissions|Failed Payouts|Referral Campaigns|Referral Settings|Referral Fraud Monitoring|Referral Policies|Referral Payouts|Fraud Cases'],
  ['support', 'Support Management', 'Support Overview|All Tickets|Open Tickets|Pending Tickets|Resolved Tickets|Escalated Tickets|Ticket Details|Disputes|Trade Execution Complaints|Exchange Connection Complaints|Billing Complaints|Copy Trading Complaints|User Reports|Knowledge Base|Support Categories|Support Settings|Support Queues|Support Metrics'],
  ['communications', 'Notifications and Communications', 'Notification Overview|All Notifications|Notification Templates|System Announcements|Email Campaigns|In-App Messages|Push Notifications|Scheduled Announcements|Delivery Reports|Notification Settings'],
  ['analytics', 'Analytics and Reports', 'Analytics Overview|User Analytics|Workspace Analytics|Trading Analytics|Execution Analytics|Exchange Analytics|Synchronization Analytics|Signal Analytics|AI Analytics|Copy Trading Analytics|Marketplace Analytics|Community Analytics|Subscription Analytics|Revenue Analytics|Referral Analytics|Payout Analytics|Support Analytics|System Usage Analytics|Custom Reports'],
  ['developer-api', 'Developer API Management', 'Developer Overview|Developer Workspaces|API Applications|API Credentials Metadata|API Usage|API Rate Limits|Webhook Management|Webhook Delivery Logs|API Errors|Developer Permissions|Integration Directory|API Documentation Settings'],
  ['risk', 'Risk Management', 'Risk Overview|Active Risk Alerts|Trading Limits|Execution Anomalies|Synchronization Anomalies|Duplicate Order Detection|Uncertain Submissions|Circuit-Breaker History|Exchange Incidents|Workspace Restrictions|Global Emergency Controls|Risk Configuration'],
  ['incidents', 'Incident Management', 'Incident Overview|Active Incidents|Resolved Incidents|Critical Incidents|Exchange Incidents|Trading Incidents|Security Incidents|Infrastructure Incidents|Incident Details|Incident Timeline|Post-Incident Reports'],
  ['infrastructure', 'System Infrastructure', 'System Overview|Backend Services|API Monitoring|Database Monitoring|Background Jobs|Scheduled Jobs|WebSocket Monitoring|Queue Monitoring|Error Monitoring|Application Logs|Deployment History|Configuration Status|Storage Monitoring|Performance Monitoring|External Services'],
  ['security', 'Security Management', 'Security Overview|Admin Login History|User Login History|Active Sessions|Suspicious Login Activity|Failed Login Attempts|API Security|API Key Activity Metadata|Permission Changes|Account Restrictions|Security Incidents|Audit Logs|Access Policies'],
  ['content-policy', 'Content and Policy Management', 'Content Overview|Terms of Service|Privacy Policy|Risk Disclosures|Trading Disclaimers|Subscription Terms|Referral Terms|Community Guidelines|Help Centre Articles|Frequently Asked Questions|Product Updates|Release Notes|Maintenance Notices|Policy Version History'],
  ['staff', 'Admin and Staff Management', 'Admin Overview|All Administrators|Create Administrator|Administrator Profiles|Roles and Permissions|Permission Groups|Admin Sessions|Admin Activity|Admin Login History|Access Requests'],
  ['settings', 'Platform Settings', 'General Settings|Branding Settings|Language Settings|Regional Settings|Currency Settings|Trading Configuration|Exchange Configuration|Synchronization Configuration|Copy Trading Configuration|Signal Configuration|AI Configuration|Marketplace Configuration|Community Configuration|Subscription Configuration|Trader Monetization Configuration|Payout Configuration|Referral Configuration|Notification Configuration|Security Configuration|API Configuration|Maintenance Mode|Feature Flags'],
];

const IMPLEMENTED_ROUTES = {
  'dashboard:admin-overview': '/overview',
  'dashboard:operation-jobs': '/operation-jobs',
  'dashboard:approvals': '/approvals',
  'dashboard:operational-alerts': '/alerts/events',
  'dashboard:alert-rules': '/alerts/rules',
  'dashboard:audit-log': '/audit',
  'users:all-users': '/users',
  'workspaces:all-workspaces': '/workspaces',
  'exchanges:exchange-overview': '/exchanges',
  'signal-sources:all-signal-sources': '/signal-sources',
  'signal-sources:source-discovery': '/source-discovery',
  'official-trader:overview': '/official-trader',
  'official-trader:exchange-accounts': '/official-trader/exchange-accounts',
  'official-trader:ai-research': '/official-trader/research',
  'official-trader:analysis-management': '/official-trader/analyses',
  'official-trader:execution-management': '/official-trader/executions',
  'official-trader:performance': '/official-trader/performance',
  'official-trader:marketplace-management': '/official-trader/marketplace',
  'official-trader:subscribers': '/official-trader/subscribers',
  'official-trader:copy-operations': '/official-trader/copy-operations',
  'official-trader:risk-management': '/official-trader/risk',
  'official-trader:settings': '/official-trader/settings',
  'trader-earnings:earnings-overview': '/marketplace/earnings',
  'platform-billing:subscription-plans': '/plans',
  'platform-billing:all-subscriptions': '/subscriptions',
  'platform-billing:payment-history': '/payments',
  'financial-management:refund-ledger': '/refunds',
  'referrals:referral-overview': '/referrals',
  'referrals:referral-policies': '/referrals/policies',
  'referrals:referral-payouts': '/referrals/payouts',
  'referrals:fraud-cases': '/referrals/fraud',
  'support:support-overview': '/support',
  'support:support-queues': '/support/queues',
  'support:support-metrics': '/support/metrics',
  'communications:delivery-reports': '/communications/email-deliveries',
  'incidents:incident-overview': '/incidents',
  'staff:roles-and-permissions': '/roles',
  'settings:feature-flags': '/feature-flags',
};

function slugify(label) {
  return label
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const ADMIN_SECTIONS = SECTION_DEFINITIONS.map(([id, label, pageList]) => ({
  id,
  label,
  items: pageList.split('|').map((page) => {
    const pageId = slugify(page);
    return {
      id: pageId,
      label: page,
      path: IMPLEMENTED_ROUTES[`${id}:${pageId}`] || `/catalog/${id}/${pageId}`,
      isImplemented: Boolean(IMPLEMENTED_ROUTES[`${id}:${pageId}`]),
    };
  }),
}));

export function getAdminCatalogPage(sectionId, pageId) {
  const section = ADMIN_SECTIONS.find((candidate) => candidate.id === sectionId);
  const page = section?.items.find((candidate) => candidate.id === pageId);
  return section && page ? { section, page } : null;
}
