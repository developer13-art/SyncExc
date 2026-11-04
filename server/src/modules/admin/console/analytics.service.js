/**
 * SyncExc Server — Admin console analytics service
 *
 * Produces platform and per-section aggregates. Every identifier comes from
 * the definitions in this file; nothing is taken from the request.
 */

import { createLogger } from '../../../lib/logger.js';
import { getResource, resolvePage } from './registry.js';

const logger = createLogger({ component: 'admin-console-analytics' });

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const BREAKDOWN_LIMIT = 10;

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normaliseRow(row) {
  const output = {};
  for (const [key, value] of Object.entries(row || {})) {
    output[key] = typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value) ? toNumber(value) : value;
  }
  return output;
}

function standard({ from, date, status = null, statusLabel, cards = [], breakdowns = [], trendLabel = 'Records', trendFilter }) {
  return {
    cards: [
      { key: 'total', label: 'Total records', from, expr: 'count(*)' },
      { key: 'new30d', label: 'New (30d)', from, expr: `count(*) FILTER (WHERE ${date} >= now() - interval '30 days')` },
      ...cards,
    ],
    trends: [
      {
        key: 'volume',
        label: trendLabel,
        from,
        date,
        filter: trendFilter,
        series: [{ key: 'count', label: trendLabel, expr: 'count(*)' }],
      },
    ],
    breakdowns: [
      ...(status ? [{ key: 'status', label: statusLabel || 'By status', from, groupBy: status, date }] : []),
      ...breakdowns,
    ],
  };
}

const DEFINITIONS = {
  dashboard: {
    cards: [
      { key: 'users', label: 'Total users', from: 'users', expr: 'count(*)' },
      { key: 'activeUsers', label: 'Active users', from: 'users', expr: "count(*) FILTER (WHERE status = 'active' AND deleted_at IS NULL)" },
      { key: 'workspaces', label: 'Workspaces', from: 'workspaces', expr: 'count(*)' },
      { key: 'activeSubscriptions', label: 'Active subscriptions', from: 'subscriptions', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'revenue30d', label: 'Revenue (30d)', from: 'subscription_payments', expr: "coalesce(sum(amount_minor) FILTER (WHERE status = 'succeeded' AND created_at >= now() - interval '30 days'), 0)" },
      { key: 'orders30d', label: 'Trading orders (30d)', from: 'trading_orders', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
      { key: 'syncOperations30d', label: 'Sync operations (30d)', from: 'sync_operations', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
      { key: 'openRiskAlerts', label: 'Open risk alerts', from: 'risk_alerts', expr: "count(*) FILTER (WHERE state = 'open')" },
    ],
    trends: [
      { key: 'signups', label: 'New users', from: 'users a', date: 'a.created_at', series: [{ key: 'users', label: 'Users', expr: 'count(*)' }] },
      { key: 'orders', label: 'Trading orders', from: 'trading_orders a', date: 'a.created_at', series: [{ key: 'orders', label: 'Orders', expr: 'count(*)' }] },
      { key: 'revenue', label: 'Captured revenue', from: 'subscription_payments a', date: 'a.created_at', filter: "a.status = 'succeeded'", series: [{ key: 'amount', label: 'Revenue (minor)', expr: 'coalesce(sum(a.amount_minor), 0)' }] },
    ],
    breakdowns: [
      { key: 'userStatus', label: 'Users by status', from: 'users a', groupBy: 'a.status', date: 'a.created_at' },
      { key: 'workspaceType', label: 'Workspaces by type', from: 'workspaces a', groupBy: 'a.type', date: 'a.created_at' },
      { key: 'paymentStatus', label: 'Payments by status', from: 'subscription_payments a', groupBy: 'a.status', date: 'a.created_at' },
    ],
  },

  users: standard({
    from: 'users a',
    date: 'a.created_at',
    status: 'a.status',
    cards: [
      { key: 'verified', label: 'Email verified', from: 'users', expr: 'count(*) FILTER (WHERE email_verified_at IS NOT NULL)' },
      { key: 'suspended', label: 'Suspended', from: 'users', expr: "count(*) FILTER (WHERE status = 'suspended')" },
    ],
    breakdowns: [
      { key: 'country', label: 'Top countries', from: 'users a', groupBy: 'a.country_code', date: 'a.created_at' },
    ],
    trendLabel: 'Signups',
  }),

  workspaces: standard({
    from: 'workspaces a',
    date: 'a.created_at',
    status: 'a.status',
    cards: [
      { key: 'active', label: 'Active workspaces', from: 'workspaces', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'closed', label: 'Closed', from: 'workspaces', expr: "count(*) FILTER (WHERE status = 'closed')" },
    ],
    breakdowns: [
      { key: 'type', label: 'By type', from: 'workspaces a', groupBy: 'a.type', date: 'a.created_at' },
      { key: 'visibility', label: 'By visibility', from: 'workspaces a', groupBy: 'a.visibility', date: 'a.created_at' },
    ],
    trendLabel: 'Workspace creation',
  }),

  exchanges: {
    cards: [
      { key: 'exchanges', label: 'Registered exchanges', from: 'exchange_registry', expr: 'count(*)' },
      { key: 'connections', label: 'Connections', from: 'exchange_connections', expr: 'count(*)' },
      { key: 'activeConnections', label: 'Active connections', from: 'exchange_connections', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'openIncidents', label: 'Open incidents', from: 'exchange_adapter_incidents', expr: 'count(*) FILTER (WHERE resolved_at IS NULL)' },
      { key: 'requests24h', label: 'Requests (24h)', from: 'exchange_request_metrics', expr: "count(*) FILTER (WHERE recorded_at >= now() - interval '24 hours')" },
      { key: 'errors24h', label: 'Server errors (24h)', from: 'exchange_request_metrics', expr: "count(*) FILTER (WHERE recorded_at >= now() - interval '24 hours' AND status_code >= 500)" },
      { key: 'avgLatency24h', label: 'Avg latency (24h)', from: 'exchange_request_metrics', expr: "coalesce(round(avg(latency_ms) FILTER (WHERE recorded_at >= now() - interval '24 hours')), 0)" },
    ],
    trends: [
      { key: 'requests', label: 'Exchange requests', from: 'exchange_request_metrics a', date: 'a.recorded_at', series: [{ key: 'requests', label: 'Requests', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'connectionStatus', label: 'Connections by status', from: 'exchange_connections a', groupBy: 'a.status', date: 'a.created_at' },
      { key: 'requestExchanges', label: 'Requests by exchange (24h)', from: 'exchange_request_metrics a', groupBy: 'a.exchange_code', date: 'a.recorded_at' },
    ],
  },

  trading: {
    cards: [
      { key: 'orders30d', label: 'Orders (30d)', from: 'trading_orders', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
      { key: 'filled30d', label: 'Filled (30d)', from: 'trading_orders', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days' AND status = 'filled')" },
      { key: 'failed30d', label: 'Failed / rejected (30d)', from: 'trading_orders', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days' AND status IN ('rejected', 'failed', 'canceled'))" },
      { key: 'openPositions', label: 'Open positions', from: 'trading_positions', expr: 'count(*) FILTER (WHERE quantity <> 0)' },
      { key: 'closedTrades30d', label: 'Closed trades (30d)', from: 'trading_closed_trades', expr: "count(*) FILTER (WHERE closed_at >= now() - interval '30 days')" },
      { key: 'realizedPnl30d', label: 'Realized PnL (30d)', from: 'trading_closed_trades', expr: "coalesce(sum(realized_pnl) FILTER (WHERE closed_at >= now() - interval '30 days'), 0)" },
    ],
    trends: [
      { key: 'orders', label: 'Orders', from: 'trading_orders a', date: 'a.created_at', series: [{ key: 'orders', label: 'Orders', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'orderStatus', label: 'Orders by status', from: 'trading_orders a', groupBy: 'a.status', date: 'a.created_at' },
      { key: 'orderSide', label: 'Orders by side', from: 'trading_orders a', groupBy: 'a.side', date: 'a.created_at' },
      { key: 'instruments', label: 'Top instruments', from: 'trading_orders a', groupBy: 'a.instrument', date: 'a.created_at' },
    ],
  },

  synchronization: {
    cards: [
      { key: 'groups', label: 'Synchronization groups', from: 'sync_groups', expr: 'count(*)' },
      { key: 'activeGroups', label: 'Active groups', from: 'sync_groups', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'pausedGroups', label: 'Paused groups', from: 'sync_groups', expr: "count(*) FILTER (WHERE status = 'paused')" },
      { key: 'operations30d', label: 'Operations (30d)', from: 'sync_operations', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
      { key: 'failed30d', label: 'Failed / unknown (30d)', from: 'sync_operations', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days' AND status IN ('failed', 'outcome_unknown', 'reconciliation_required'))" },
      { key: 'avgLatency', label: 'Avg latency (ms)', from: 'sync_metrics', expr: "coalesce(round(avg(avg_latency_ms) FILTER (WHERE period_start >= now() - interval '30 days')), 0)" },
    ],
    trends: [
      { key: 'operations', label: 'Sync operations', from: 'sync_operations a', date: 'a.created_at', series: [{ key: 'operations', label: 'Operations', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'groupStatus', label: 'Groups by status', from: 'sync_groups a', groupBy: 'a.status', date: 'a.created_at' },
      { key: 'operationStatus', label: 'Operations by status', from: 'sync_operations a', groupBy: 'a.status', date: 'a.created_at' },
    ],
  },

  'signal-sources': {
    cards: [
      { key: 'sources', label: 'Signal sources', from: 'signal_sources', expr: 'count(*)' },
      { key: 'active', label: 'Active', from: 'signal_sources', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'monitoring', label: 'Monitoring enabled', from: 'signal_sources', expr: 'count(*) FILTER (WHERE monitoring_enabled = true)' },
      { key: 'messages30d', label: 'Messages (30d)', from: 'signal_messages', expr: "count(*) FILTER (WHERE received_at >= now() - interval '30 days')" },
      { key: 'failed30d', label: 'Failed processing (30d)', from: 'signal_messages', expr: "count(*) FILTER (WHERE received_at >= now() - interval '30 days' AND processing_status = 'failed')" },
      { key: 'degraded', label: 'Unhealthy sources', from: 'signal_sources', expr: "count(*) FILTER (WHERE health_state NOT IN ('healthy', 'unknown'))" },
    ],
    trends: [
      { key: 'messages', label: 'Signal messages', from: 'signal_messages a', date: 'a.received_at', series: [{ key: 'messages', label: 'Messages', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'sourceType', label: 'Sources by type', from: 'signal_sources a', groupBy: 'a.type', date: 'a.created_at' },
      { key: 'sourceHealth', label: 'Sources by health', from: 'signal_sources a', groupBy: 'a.health_state', date: 'a.created_at' },
    ],
  },

  'ai-signals': {
    cards: [
      { key: 'candidates30d', label: 'Signal candidates (30d)', from: 'trading_signal_candidates', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
      { key: 'eligible30d', label: 'Eligible (30d)', from: 'trading_signal_candidates', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days' AND status = 'eligible')" },
      { key: 'rejected30d', label: 'Rejected (30d)', from: 'trading_signal_candidates', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days' AND status = 'rejected')" },
      { key: 'reviewRequired', label: 'Review required', from: 'trading_signal_candidates', expr: "count(*) FILTER (WHERE status = 'review_required')" },
      { key: 'validations30d', label: 'Validations (30d)', from: 'trading_signal_validations', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
      { key: 'reviews30d', label: 'Manual reviews (30d)', from: 'trading_signal_reviews', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
    ],
    trends: [
      { key: 'candidates', label: 'Signal candidates', from: 'trading_signal_candidates a', date: 'a.created_at', series: [{ key: 'candidates', label: 'Candidates', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'candidateStatus', label: 'Candidates by status', from: 'trading_signal_candidates a', groupBy: 'a.status', date: 'a.created_at' },
      { key: 'messageStatus', label: 'Messages by processing status', from: 'signal_messages a', groupBy: 'a.processing_status', date: 'a.received_at' },
    ],
  },

  'copy-trading': {
    cards: [
      { key: 'configurations', label: 'Copy configurations', from: 'copy_configurations', expr: 'count(*)' },
      { key: 'activeConfigurations', label: 'Active configurations', from: 'copy_configurations', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'destinations', label: 'Destination accounts', from: 'copy_destination_accounts', expr: 'count(*)' },
      { key: 'enabledDestinations', label: 'Enabled destinations', from: 'copy_destination_accounts', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'intents30d', label: 'Execution intents (30d)', from: 'copy_execution_intents', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
      { key: 'failed30d', label: 'Failed intents (30d)', from: 'copy_execution_intents', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days' AND status = 'failed')" },
    ],
    trends: [
      { key: 'intents', label: 'Execution intents', from: 'copy_execution_intents a', date: 'a.created_at', series: [{ key: 'intents', label: 'Intents', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'configurationStatus', label: 'Configurations by status', from: 'copy_configurations a', groupBy: 'a.status', date: 'a.created_at' },
      { key: 'intentStatus', label: 'Intents by status', from: 'copy_execution_intents a', groupBy: 'a.status', date: 'a.created_at' },
    ],
  },

  marketplace: {
    cards: [
      { key: 'providers', label: 'Providers', from: 'marketplace_provider_profiles', expr: 'count(*)' },
      { key: 'approvedProviders', label: 'Approved providers', from: 'marketplace_provider_profiles', expr: "count(*) FILTER (WHERE moderation_state = 'approved')" },
      { key: 'restricted', label: 'Restricted providers', from: 'marketplace_provider_profiles', expr: "count(*) FILTER (WHERE moderation_state IN ('restricted', 'suspended'))" },
      { key: 'activePlans', label: 'Active plans', from: 'marketplace_provider_plans', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'activeSubscriptions', label: 'Active subscriptions', from: 'marketplace_subscriptions', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'signals30d', label: 'Published signals (30d)', from: 'marketplace_published_signals', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
    ],
    trends: [
      { key: 'subscriptions', label: 'New marketplace subscriptions', from: 'marketplace_subscriptions a', date: 'a.created_at', series: [{ key: 'subscriptions', label: 'Subscriptions', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'providerState', label: 'Providers by moderation state', from: 'marketplace_provider_profiles a', groupBy: 'a.moderation_state', date: 'a.created_at' },
      { key: 'subscriptionStatus', label: 'Subscriptions by status', from: 'marketplace_subscriptions a', groupBy: 'a.status', date: 'a.created_at' },
    ],
  },

  community: {
    cards: [
      { key: 'posts30d', label: 'Posts (30d)', from: 'community_posts', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days' AND deleted_at IS NULL)" },
      { key: 'comments30d', label: 'Comments (30d)', from: 'community_comments', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days' AND deleted_at IS NULL)" },
      { key: 'activeGroups', label: 'Active groups', from: 'community_groups', expr: 'count(*)' },
      { key: 'openModeration', label: 'Open moderation cases', from: 'community_moderation_cases', expr: "count(*) FILTER (WHERE state = 'open')" },
      { key: 'profiles', label: 'Community profiles', from: 'community_profiles', expr: 'count(*)' },
    ],
    trends: [
      { key: 'posts', label: 'Community posts', from: 'community_posts a', date: 'a.created_at', filter: 'a.deleted_at IS NULL', series: [{ key: 'posts', label: 'Posts', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'postDestination', label: 'Posts by destination', from: 'community_posts a', groupBy: 'a.destination_type', date: 'a.created_at' },
      { key: 'moderationState', label: 'Moderation by state', from: 'community_moderation_cases a', groupBy: 'a.state', date: 'a.opened_at' },
    ],
  },

  creators: standard({
    from: 'creator_monetization_profiles a',
    date: 'a.created_at',
    status: 'a.state',
    cards: [
      { key: 'approved', label: 'Approved', from: 'creator_monetization_profiles', expr: "count(*) FILTER (WHERE state = 'approved')" },
      { key: 'restricted', label: 'Restricted / suspended', from: 'creator_monetization_profiles', expr: "count(*) FILTER (WHERE state IN ('restricted', 'suspended'))" },
    ],
    trendLabel: 'Creator profiles',
  }),

  'trader-subscriptions': standard({
    from: 'marketplace_subscriptions a',
    date: 'a.created_at',
    status: 'a.status',
    cards: [
      { key: 'active', label: 'Active subscriptions', from: 'marketplace_subscriptions', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'pastDue', label: 'Past due', from: 'marketplace_subscriptions', expr: "count(*) FILTER (WHERE status = 'past_due')" },
      { key: 'canceled30d', label: 'Canceled (30d)', from: 'marketplace_subscriptions', expr: "count(*) FILTER (WHERE canceled_at >= now() - interval '30 days')" },
    ],
    breakdowns: [
      { key: 'provider', label: 'By billing provider', from: 'marketplace_subscriptions a', groupBy: 'a.billing_provider', date: 'a.created_at' },
    ],
    trendLabel: 'New subscriptions',
  }),

  subscribers: {
    cards: [
      { key: 'activeEntitlements', label: 'Active entitlements', from: 'subscription_entitlements', expr: "count(*) FILTER (WHERE revoked_at IS NULL AND (valid_until IS NULL OR valid_until > now()))" },
      { key: 'subscribers', label: 'Distinct subscribers', from: 'subscription_entitlements', expr: 'count(DISTINCT billing_scope_id) FILTER (WHERE revoked_at IS NULL)' },
      { key: 'expiring7d', label: 'Expiring (7d)', from: 'subscription_entitlements', expr: "count(*) FILTER (WHERE revoked_at IS NULL AND valid_until BETWEEN now() AND now() + interval '7 days')" },
      { key: 'revoked30d', label: 'Revoked (30d)', from: 'subscription_entitlements', expr: "count(*) FILTER (WHERE revoked_at >= now() - interval '30 days')" },
    ],
    trends: [
      { key: 'entitlements', label: 'Entitlements granted', from: 'subscription_entitlements a', date: 'a.created_at', series: [{ key: 'entitlements', label: 'Entitlements', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'feature', label: 'By feature', from: 'subscription_entitlements a', groupBy: 'a.feature_key', date: 'a.created_at' },
    ],
  },

  'trader-earnings': {
    cards: [
      { key: 'gross30d', label: 'Gross earnings (30d)', from: 'marketplace_trader_earnings', expr: "coalesce(sum(gross_amount_minor) FILTER (WHERE created_at >= now() - interval '30 days'), 0)" },
      { key: 'net30d', label: 'Trader net (30d)', from: 'marketplace_trader_earnings', expr: "coalesce(sum(trader_net_amount_minor) FILTER (WHERE created_at >= now() - interval '30 days'), 0)" },
      { key: 'pendingAmount', label: 'Pending amount', from: 'marketplace_trader_earnings', expr: "coalesce(sum(trader_net_amount_minor) FILTER (WHERE status = 'pending'), 0)" },
      { key: 'paidAmount', label: 'Paid amount', from: 'marketplace_trader_earnings', expr: "coalesce(sum(trader_net_amount_minor) FILTER (WHERE status = 'paid'), 0)" },
      { key: 'reversed30d', label: 'Reversed (30d)', from: 'marketplace_trader_earnings', expr: "count(*) FILTER (WHERE status = 'reversed' AND created_at >= now() - interval '30 days')" },
    ],
    trends: [
      { key: 'earnings', label: 'Trader earnings', from: 'marketplace_trader_earnings a', date: 'a.created_at', series: [
        { key: 'gross', label: 'Gross', expr: 'coalesce(sum(a.gross_amount_minor), 0)' },
        { key: 'net', label: 'Net', expr: 'coalesce(sum(a.trader_net_amount_minor), 0)' },
      ] },
    ],
    breakdowns: [
      { key: 'status', label: 'By status', from: 'marketplace_trader_earnings a', groupBy: 'a.status', date: 'a.created_at' },
    ],
  },

  payouts: {
    cards: [
      { key: 'pending', label: 'Pending requests', from: 'marketplace_trader_payout_requests', expr: "count(*) FILTER (WHERE status = 'pending')" },
      { key: 'pendingAmount', label: 'Pending amount', from: 'marketplace_trader_payout_requests', expr: "coalesce(sum(amount_minor) FILTER (WHERE status IN ('pending', 'under_review', 'approved', 'processing')), 0)" },
      { key: 'paid30d', label: 'Paid (30d)', from: 'marketplace_trader_payout_requests', expr: "count(*) FILTER (WHERE status = 'paid' AND reviewed_at >= now() - interval '30 days')" },
      { key: 'paidAmount30d', label: 'Paid amount (30d)', from: 'marketplace_trader_payout_requests', expr: "coalesce(sum(amount_minor) FILTER (WHERE status = 'paid' AND reviewed_at >= now() - interval '30 days'), 0)" },
      { key: 'failed', label: 'Failed / rejected', from: 'marketplace_trader_payout_requests', expr: "count(*) FILTER (WHERE status IN ('failed', 'rejected', 'reversed'))" },
    ],
    trends: [
      { key: 'requests', label: 'Payout requests', from: 'marketplace_trader_payout_requests a', date: 'a.created_at', series: [{ key: 'requests', label: 'Requests', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'status', label: 'By status', from: 'marketplace_trader_payout_requests a', groupBy: 'a.status', date: 'a.created_at' },
    ],
  },

  revenue: {
    cards: [
      { key: 'payments30d', label: 'Payments (30d)', from: 'subscription_payments', expr: "coalesce(sum(amount_minor) FILTER (WHERE status = 'succeeded' AND created_at >= now() - interval '30 days'), 0)" },
      { key: 'commission30d', label: 'Platform commission (30d)', from: 'platform_finance_ledger', expr: "coalesce(sum(amount_minor) FILTER (WHERE entry_type = 'platform_commission' AND direction = 'credit' AND created_at >= now() - interval '30 days'), 0)" },
      { key: 'refunds30d', label: 'Refunds (30d)', from: 'refund_records', expr: "coalesce(sum(amount_minor) FILTER (WHERE status IN ('approved', 'processing', 'completed') AND created_at >= now() - interval '30 days'), 0)" },
      { key: 'payouts30d', label: 'Payouts (30d)', from: 'marketplace_trader_payout_requests', expr: "coalesce(sum(amount_minor) FILTER (WHERE status = 'paid' AND reviewed_at >= now() - interval '30 days'), 0)" },
    ],
    trends: [
      { key: 'ledger', label: 'Ledger movement', from: 'platform_finance_ledger a', date: 'a.created_at', series: [
        { key: 'credits', label: 'Credits', expr: "coalesce(sum(a.amount_minor) FILTER (WHERE a.direction = 'credit'), 0)" },
        { key: 'debits', label: 'Debits', expr: "coalesce(sum(a.amount_minor) FILTER (WHERE a.direction = 'debit'), 0)" },
      ] },
    ],
    breakdowns: [
      { key: 'entryType', label: 'Ledger by entry type', from: 'platform_finance_ledger a', groupBy: 'a.entry_type', date: 'a.created_at' },
      { key: 'account', label: 'Ledger by account', from: 'platform_finance_ledger a', groupBy: 'a.account', date: 'a.created_at' },
    ],
  },

  campaigns: {
    cards: [
      { key: 'campaigns', label: 'Campaigns', from: 'monetization_campaigns', expr: 'count(*)' },
      { key: 'active', label: 'Active campaigns', from: 'monetization_campaigns', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'scheduled', label: 'Scheduled', from: 'monetization_campaigns', expr: "count(*) FILTER (WHERE starts_at > now())" },
      { key: 'redemptions30d', label: 'Redemptions (30d)', from: 'campaign_redemptions', expr: "count(*) FILTER (WHERE redeemed_at >= now() - interval '30 days')" },
      { key: 'discount30d', label: 'Discount value (30d)', from: 'campaign_redemptions', expr: "coalesce(sum(discount_amount_minor) FILTER (WHERE redeemed_at >= now() - interval '30 days'), 0)" },
    ],
    trends: [
      { key: 'redemptions', label: 'Campaign redemptions', from: 'campaign_redemptions a', date: 'a.redeemed_at', series: [{ key: 'redemptions', label: 'Redemptions', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'status', label: 'Campaigns by status', from: 'monetization_campaigns a', groupBy: 'a.status', date: 'a.created_at' },
      { key: 'campaignType', label: 'Campaigns by type', from: 'monetization_campaigns a', groupBy: 'a.campaign_type', date: 'a.created_at' },
    ],
  },

  'subscription-operations': {
    cards: [
      { key: 'active', label: 'Active subscriptions', from: 'subscriptions', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'pastDue', label: 'Past due', from: 'subscriptions', expr: "count(*) FILTER (WHERE status = 'past_due')" },
      { key: 'canceling', label: 'Canceling at period end', from: 'subscriptions', expr: "count(*) FILTER (WHERE cancel_at_period_end = true AND status = 'active')" },
      { key: 'renewals7d', label: 'Renewals (7d)', from: 'subscriptions', expr: "count(*) FILTER (WHERE status = 'active' AND next_billing_at BETWEEN now() AND now() + interval '7 days')" },
      { key: 'canceled30d', label: 'Canceled (30d)', from: 'subscriptions', expr: "count(*) FILTER (WHERE canceled_at >= now() - interval '30 days')" },
    ],
    trends: [
      { key: 'subscriptions', label: 'New platform subscriptions', from: 'subscriptions a', date: 'a.created_at', series: [{ key: 'subscriptions', label: 'Subscriptions', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'status', label: 'By status', from: 'subscriptions a', groupBy: 'a.status', date: 'a.created_at' },
    ],
  },

  'platform-billing': {
    cards: [
      { key: 'activeSubscriptions', label: 'Active subscriptions', from: 'subscriptions', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'payments30d', label: 'Payments (30d)', from: 'subscription_payments', expr: "coalesce(sum(amount_minor) FILTER (WHERE status = 'succeeded' AND created_at >= now() - interval '30 days'), 0)" },
      { key: 'failed30d', label: 'Failed payments (30d)', from: 'subscription_payments', expr: "count(*) FILTER (WHERE status = 'failed' AND created_at >= now() - interval '30 days')" },
      { key: 'invoicesPaid30d', label: 'Invoices paid (30d)', from: 'billing_invoices', expr: "count(*) FILTER (WHERE status = 'paid' AND paid_at >= now() - interval '30 days')" },
      { key: 'invoicesOpen', label: 'Open invoices', from: 'billing_invoices', expr: "count(*) FILTER (WHERE status IN ('issued', 'due'))" },
    ],
    trends: [
      { key: 'payments', label: 'Billing payments', from: 'subscription_payments a', date: 'a.created_at', series: [{ key: 'amount', label: 'Amount', expr: "coalesce(sum(a.amount_minor) FILTER (WHERE a.status = 'succeeded'), 0)" }] },
    ],
    breakdowns: [
      { key: 'paymentStatus', label: 'Payments by status', from: 'subscription_payments a', groupBy: 'a.status', date: 'a.created_at' },
      { key: 'invoiceStatus', label: 'Invoices by status', from: 'billing_invoices a', groupBy: 'a.status', date: 'a.issued_at' },
    ],
  },

  'financial-management': {
    cards: [
      { key: 'entries30d', label: 'Ledger entries (30d)', from: 'platform_finance_ledger', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
      { key: 'credits30d', label: 'Credits (30d)', from: 'platform_finance_ledger', expr: "coalesce(sum(amount_minor) FILTER (WHERE direction = 'credit' AND created_at >= now() - interval '30 days'), 0)" },
      { key: 'debits30d', label: 'Debits (30d)', from: 'platform_finance_ledger', expr: "coalesce(sum(amount_minor) FILTER (WHERE direction = 'debit' AND created_at >= now() - interval '30 days'), 0)" },
      { key: 'adjustments30d', label: 'Adjustments (30d)', from: 'finance_adjustments', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
      { key: 'refunds30d', label: 'Refunds (30d)', from: 'refund_records', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
    ],
    trends: [
      { key: 'ledger', label: 'Ledger entries', from: 'platform_finance_ledger a', date: 'a.created_at', series: [{ key: 'entries', label: 'Entries', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'entryType', label: 'By entry type', from: 'platform_finance_ledger a', groupBy: 'a.entry_type', date: 'a.created_at' },
      { key: 'account', label: 'By account', from: 'platform_finance_ledger a', groupBy: 'a.account', date: 'a.created_at' },
    ],
  },

  disputes: {
    cards: [
      { key: 'refundsPending', label: 'Refunds pending', from: 'refund_records', expr: "count(*) FILTER (WHERE status IN ('requested', 'under_review', 'approved'))" },
      { key: 'refunds30d', label: 'Refunds (30d)', from: 'refund_records', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
      { key: 'refundedAmount30d', label: 'Refunded amount (30d)', from: 'refund_records', expr: "coalesce(sum(amount_minor) FILTER (WHERE status IN ('approved', 'processing', 'completed') AND created_at >= now() - interval '30 days'), 0)" },
      { key: 'openDisputes', label: 'Open payment disputes', from: 'payment_disputes', expr: "count(*) FILTER (WHERE status NOT IN ('won', 'lost', 'closed'))" },
    ],
    trends: [
      { key: 'refunds', label: 'Refund requests', from: 'refund_records a', date: 'a.created_at', series: [{ key: 'refunds', label: 'Refunds', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'refundStatus', label: 'Refunds by status', from: 'refund_records a', groupBy: 'a.status', date: 'a.created_at' },
      { key: 'disputeStatus', label: 'Disputes by status', from: 'payment_disputes a', groupBy: 'a.status', date: 'a.created_at' },
    ],
  },

  referrals: {
    cards: [
      { key: 'affiliates', label: 'Affiliates', from: 'affiliates', expr: 'count(*)' },
      { key: 'activeAffiliates', label: 'Active affiliates', from: 'affiliates', expr: "count(*) FILTER (WHERE status = 'active')" },
      { key: 'attributions30d', label: 'Attributions (30d)', from: 'referral_attributions', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
      { key: 'pendingCommission', label: 'Pending commission', from: 'commission_accruals', expr: "coalesce(sum(amount_minor) FILTER (WHERE state IN ('accumulated', 'approved', 'held')), 0)" },
      { key: 'paidCommission', label: 'Released commission', from: 'commission_accruals', expr: "coalesce(sum(amount_minor) FILTER (WHERE state = 'released'), 0)" },
      { key: 'fraudOpen', label: 'Open fraud cases', from: 'affiliate_fraud_cases', expr: "count(*) FILTER (WHERE closed_at IS NULL)" },
    ],
    trends: [
      { key: 'attributions', label: 'Referral attributions', from: 'referral_attributions a', date: 'a.created_at', series: [{ key: 'attributions', label: 'Attributions', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'affiliateStatus', label: 'Affiliates by status', from: 'affiliates a', groupBy: 'a.status', date: 'a.created_at' },
      { key: 'commissionState', label: 'Commission by state', from: 'commission_accruals a', groupBy: 'a.state', date: 'a.accrued_at' },
    ],
  },

  support: {
    cards: [
      { key: 'openTickets', label: 'Open tickets', from: 'support_tickets', expr: "count(*) FILTER (WHERE status NOT IN ('resolved', 'closed'))" },
      { key: 'new30d', label: 'New tickets (30d)', from: 'support_tickets', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
      { key: 'resolved30d', label: 'Resolved (30d)', from: 'support_tickets', expr: "count(*) FILTER (WHERE resolved_at >= now() - interval '30 days')" },
      { key: 'escalated', label: 'Escalated', from: 'support_tickets', expr: "count(*) FILTER (WHERE status = 'escalated')" },
      { key: 'avgFirstResponse', label: 'Avg first response (min)', from: 'support_tickets', expr: "coalesce(round(avg(extract(epoch FROM (first_response_at - created_at)) / 60) FILTER (WHERE first_response_at IS NOT NULL AND created_at >= now() - interval '30 days')), 0)" },
    ],
    trends: [
      { key: 'tickets', label: 'Support tickets', from: 'support_tickets a', date: 'a.created_at', series: [{ key: 'tickets', label: 'Tickets', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'status', label: 'By status', from: 'support_tickets a', groupBy: 'a.status', date: 'a.created_at' },
      { key: 'priority', label: 'By priority', from: 'support_tickets a', groupBy: 'a.priority', date: 'a.created_at' },
    ],
  },

  communications: {
    cards: [
      { key: 'notifications30d', label: 'Notifications (30d)', from: 'notifications', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
      { key: 'delivered30d', label: 'Delivered (30d)', from: 'notifications', expr: "count(*) FILTER (WHERE status = 'delivered' AND created_at >= now() - interval '30 days')" },
      { key: 'failed30d', label: 'Failed (30d)', from: 'notifications', expr: "count(*) FILTER (WHERE status = 'failed' AND created_at >= now() - interval '30 days')" },
      { key: 'announcementsSent30d', label: 'Announcements sent (30d)', from: 'platform_announcements', expr: "count(*) FILTER (WHERE status = 'sent' AND sent_at >= now() - interval '30 days')" },
      { key: 'templates', label: 'Templates', from: 'notification_templates', expr: 'count(*)' },
    ],
    trends: [
      { key: 'notifications', label: 'Notifications', from: 'notifications a', date: 'a.created_at', series: [{ key: 'notifications', label: 'Notifications', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'status', label: 'Notifications by status', from: 'notifications a', groupBy: 'a.status', date: 'a.created_at' },
      { key: 'category', label: 'Notifications by category', from: 'notifications a', groupBy: 'a.category', date: 'a.created_at' },
    ],
  },

  'developer-api': {
    cards: [
      { key: 'applications', label: 'Applications', from: 'developer_applications', expr: 'count(*)' },
      { key: 'activeApplications', label: 'Active applications', from: 'developer_applications', expr: "count(*) FILTER (WHERE state = 'active')" },
      { key: 'requests24h', label: 'API requests (24h)', from: 'developer_api_request_logs', expr: "count(*) FILTER (WHERE created_at >= now() - interval '24 hours')" },
      { key: 'errors24h', label: 'API errors (24h)', from: 'developer_api_request_logs', expr: "count(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND status >= 400)" },
      { key: 'avgLatency24h', label: 'Avg latency (ms, 24h)', from: 'developer_api_request_logs', expr: "coalesce(round(avg(duration_ms) FILTER (WHERE created_at >= now() - interval '24 hours')), 0)" },
      { key: 'webhookFailures', label: 'Failed webhook deliveries', from: 'developer_webhook_deliveries', expr: "count(*) FILTER (WHERE state = 'failed')" },
    ],
    trends: [
      { key: 'requests', label: 'API requests', from: 'developer_api_request_logs a', date: 'a.created_at', series: [{ key: 'requests', label: 'Requests', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'applicationState', label: 'Applications by state', from: 'developer_applications a', groupBy: 'a.state', date: 'a.created_at' },
      { key: 'webhookState', label: 'Webhook deliveries by state', from: 'developer_webhook_deliveries a', groupBy: 'a.state', date: 'a.created_at' },
    ],
  },

  risk: {
    cards: [
      { key: 'openAlerts', label: 'Open alerts', from: 'risk_alerts', expr: "count(*) FILTER (WHERE state = 'open')" },
      { key: 'evaluations30d', label: 'Evaluations (30d)', from: 'risk_evaluations', expr: "count(*) FILTER (WHERE evaluated_at >= now() - interval '30 days')" },
      { key: 'blocked30d', label: 'Blocked (30d)', from: 'risk_evaluations', expr: "count(*) FILTER (WHERE outcome = 'blocked' AND evaluated_at >= now() - interval '30 days')" },
      { key: 'approvalRequired30d', label: 'Approval required (30d)', from: 'risk_evaluations', expr: "count(*) FILTER (WHERE outcome = 'approval_required' AND evaluated_at >= now() - interval '30 days')" },
      { key: 'openBreakers', label: 'Open circuit breakers', from: 'risk_circuit_breakers', expr: "count(*) FILTER (WHERE state = 'open')" },
    ],
    trends: [
      { key: 'evaluations', label: 'Risk evaluations', from: 'risk_evaluations a', date: 'a.evaluated_at', series: [{ key: 'evaluations', label: 'Evaluations', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'outcome', label: 'By outcome', from: 'risk_evaluations a', groupBy: 'a.outcome', date: 'a.evaluated_at' },
      { key: 'alertSeverity', label: 'Alerts by severity', from: 'risk_alerts a', groupBy: 'a.severity', date: 'a.created_at' },
    ],
  },

  incidents: {
    cards: [
      { key: 'active', label: 'Active incidents', from: 'platform_incidents', expr: "count(*) FILTER (WHERE status <> 'resolved')" },
      { key: 'sev1Active', label: 'Sev-1 active', from: 'platform_incidents', expr: "count(*) FILTER (WHERE severity = 'sev1' AND status <> 'resolved')" },
      { key: 'resolved30d', label: 'Resolved (30d)', from: 'platform_incidents', expr: "count(*) FILTER (WHERE resolved_at >= now() - interval '30 days')" },
      { key: 'events30d', label: 'Incident events (30d)', from: 'platform_incident_events', expr: "count(*) FILTER (WHERE occurred_at >= now() - interval '30 days')" },
    ],
    trends: [
      { key: 'incidents', label: 'Incidents opened', from: 'platform_incidents a', date: 'a.started_at', series: [{ key: 'incidents', label: 'Incidents', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'severity', label: 'By severity', from: 'platform_incidents a', groupBy: 'a.severity', date: 'a.started_at' },
      { key: 'status', label: 'By status', from: 'platform_incidents a', groupBy: 'a.status', date: 'a.started_at' },
    ],
  },

  infrastructure: {
    cards: [
      { key: 'jobsPending', label: 'Jobs pending', from: 'jobs', expr: "count(*) FILTER (WHERE status IN ('pending', 'retry_scheduled'))" },
      { key: 'jobsRunning', label: 'Jobs running', from: 'jobs', expr: "count(*) FILTER (WHERE status = 'running')" },
      { key: 'jobsFailed', label: 'Jobs failed', from: 'jobs', expr: "count(*) FILTER (WHERE status = 'failed')" },
      { key: 'jobsDeadLettered', label: 'Jobs dead-lettered', from: 'jobs', expr: "count(*) FILTER (WHERE status = 'dead_lettered')" },
      { key: 'outboxPending', label: 'Outbox pending', from: 'outbox_events', expr: "count(*) FILTER (WHERE status = 'pending')" },
      { key: 'outboxFailed', label: 'Outbox failed', from: 'outbox_events', expr: "count(*) FILTER (WHERE status IN ('failed', 'dead_lettered'))" },
      { key: 'deployments30d', label: 'Deployments (30d)', from: 'platform_deployments', expr: "count(*) FILTER (WHERE deployed_at >= now() - interval '30 days')" },
    ],
    trends: [
      { key: 'jobs', label: 'Jobs created', from: 'jobs a', date: 'a.created_at', series: [{ key: 'jobs', label: 'Jobs', expr: 'count(*)' }] },
      { key: 'outbox', label: 'Outbox events', from: 'outbox_events a', date: 'a.occurred_at', series: [{ key: 'events', label: 'Events', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'jobStatus', label: 'Jobs by status', from: 'jobs a', groupBy: 'a.status', date: 'a.created_at' },
      { key: 'jobType', label: 'Top job types', from: 'jobs a', groupBy: 'a.job_type', date: 'a.created_at' },
      { key: 'outboxStatus', label: 'Outbox by status', from: 'outbox_events a', groupBy: 'a.status', date: 'a.occurred_at' },
    ],
  },

  security: {
    cards: [
      { key: 'activeSessions', label: 'Active sessions', from: 'user_sessions', expr: "count(*) FILTER (WHERE revoked_at IS NULL AND expires_at > now())" },
      { key: 'failedLogins30d', label: 'Failed logins (30d)', from: 'user_security_events', expr: "count(*) FILTER (WHERE outcome = 'failure' AND event_type ILIKE '%login%' AND occurred_at >= now() - interval '30 days')" },
      { key: 'blocked30d', label: 'Blocked events (30d)', from: 'user_security_events', expr: "count(*) FILTER (WHERE outcome = 'blocked' AND occurred_at >= now() - interval '30 days')" },
      { key: 'audit30d', label: 'Admin audit events (30d)', from: 'admin_audit_events', expr: "count(*) FILTER (WHERE occurred_at >= now() - interval '30 days')" },
      { key: 'pendingApprovals', label: 'Pending approvals', from: 'admin_approval_requests', expr: "count(*) FILTER (WHERE status = 'pending')" },
    ],
    trends: [
      { key: 'security', label: 'Security events', from: 'user_security_events a', date: 'a.occurred_at', series: [{ key: 'events', label: 'Events', expr: 'count(*)' }] },
      { key: 'audit', label: 'Admin audit events', from: 'admin_audit_events a', date: 'a.occurred_at', series: [{ key: 'events', label: 'Events', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'eventType', label: 'Security events by type', from: 'user_security_events a', groupBy: 'a.event_type', date: 'a.occurred_at' },
      { key: 'outcome', label: 'Security events by outcome', from: 'user_security_events a', groupBy: 'a.outcome', date: 'a.occurred_at' },
    ],
  },

  'content-policy': {
    cards: [
      { key: 'pages', label: 'Content pages', from: 'platform_content_pages', expr: 'count(*)' },
      { key: 'published', label: 'Published', from: 'platform_content_pages', expr: "count(*) FILTER (WHERE status = 'published')" },
      { key: 'drafts', label: 'Drafts', from: 'platform_content_pages', expr: "count(*) FILTER (WHERE status = 'draft')" },
      { key: 'archived', label: 'Archived', from: 'platform_content_pages', expr: "count(*) FILTER (WHERE status = 'archived')" },
      { key: 'acceptances30d', label: 'Policy acceptances (30d)', from: 'platform_content_acceptances', expr: "count(*) FILTER (WHERE accepted_at >= now() - interval '30 days')" },
    ],
    trends: [
      { key: 'pages', label: 'Content pages created', from: 'platform_content_pages a', date: 'a.created_at', series: [{ key: 'pages', label: 'Pages', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'contentType', label: 'By content type', from: 'platform_content_pages a', groupBy: 'a.content_type', date: 'a.created_at' },
      { key: 'status', label: 'By status', from: 'platform_content_pages a', groupBy: 'a.status', date: 'a.created_at' },
    ],
  },

  staff: {
    cards: [
      { key: 'administrators', label: 'Active administrators', from: 'admin_user_role_assignments', expr: 'count(DISTINCT user_id) FILTER (WHERE revoked_at IS NULL)' },
      { key: 'roles', label: 'Roles', from: 'admin_role_definitions', expr: 'count(*)' },
      { key: 'pendingApprovals', label: 'Pending approvals', from: 'admin_approval_requests', expr: "count(*) FILTER (WHERE status = 'pending')" },
      { key: 'audit30d', label: 'Admin actions (30d)', from: 'admin_audit_events', expr: "count(*) FILTER (WHERE occurred_at >= now() - interval '30 days')" },
    ],
    trends: [
      { key: 'actions', label: 'Admin actions', from: 'admin_audit_events a', date: 'a.occurred_at', series: [{ key: 'actions', label: 'Actions', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'actions', label: 'Top admin actions', from: 'admin_audit_events a', groupBy: 'a.action', date: 'a.occurred_at' },
      { key: 'approvalStatus', label: 'Approvals by status', from: 'admin_approval_requests a', groupBy: 'a.status', date: 'a.created_at' },
    ],
  },

  settings: {
    cards: [
      { key: 'settings', label: 'Platform settings', from: 'platform_settings', expr: 'count(*)' },
      { key: 'sensitive', label: 'Sensitive settings', from: 'platform_settings', expr: 'count(*) FILTER (WHERE is_sensitive = true)' },
      { key: 'flags', label: 'Feature flags', from: 'admin_feature_flags', expr: 'count(*)' },
      { key: 'flagsEnabled', label: 'Enabled flags', from: 'admin_feature_flags', expr: 'count(*) FILTER (WHERE enabled = true)' },
      { key: 'changes30d', label: 'Setting changes (30d)', from: 'platform_setting_versions', expr: "count(*) FILTER (WHERE created_at >= now() - interval '30 days')" },
    ],
    trends: [
      { key: 'changes', label: 'Setting changes', from: 'platform_setting_versions a', date: 'a.created_at', series: [{ key: 'changes', label: 'Changes', expr: 'count(*)' }] },
    ],
    breakdowns: [
      { key: 'category', label: 'Settings by category', from: 'platform_settings a', groupBy: 'a.category', date: 'a.created_at' },
      { key: 'flagEnvironment', label: 'Flags by environment', from: 'admin_feature_flags a', groupBy: 'a.environment', date: 'a.created_at' },
    ],
  },
};

DEFINITIONS.analytics = DEFINITIONS.dashboard;

function fallbackDefinition(sectionId) {
  const page = resolvePage(sectionId, 'overview') || resolvePage(sectionId, 'all-records');
  if (!page?.resource) return null;

  const internal = getResource(page.resource.key);
  if (!internal?.from) return null;

  const { from, dateColumn: date, statusColumn } = internal;
  const breakdowns = [];
  if (statusColumn && date) {
    breakdowns.push({
      key: 'status',
      label: 'By status',
      from,
      groupBy: statusColumn,
      date,
    });
  }

  return {
    cards: (internal.summary || []).map((metric) => ({
      key: metric.key,
      label: metric.label,
      from,
      expr: metric.expr,
    })),
    trends: date
      ? [{ key: 'volume', label: 'Records', from, date, series: [{ key: 'count', label: 'Records', expr: 'count(*)' }] }]
      : [],
    breakdowns,
  };
}

async function runCard(db, card) {
  try {
    const result = await db.query(`SELECT ${card.expr} AS value FROM ${card.from}`);
    return { key: card.key, label: card.label, value: toNumber(result.rows[0]?.value) };
  } catch (err) {
    logger.warn({ err, card: card.key }, 'Admin analytics card failed');
    return { key: card.key, label: card.label, value: 0, error: true };
  }
}

async function runTrend(db, trend, since, until) {
  try {
    const series = trend.series
      .map((entry) => `${entry.expr} AS "${entry.key}"`)
      .join(', ');
    const filter = trend.filter ? `AND (${trend.filter})` : '';
    const result = await db.query(
      `SELECT to_char(date_trunc('day', ${trend.date}), 'YYYY-MM-DD') AS day, ${series}
         FROM ${trend.from}
        WHERE ${trend.date} >= $1 AND ${trend.date} <= $2 ${filter}
        GROUP BY 1
        ORDER BY 1`,
      [since.toISOString(), until.toISOString()],
    );
    return {
      key: trend.key,
      label: trend.label,
      series: trend.series.map((entry) => ({ key: entry.key, label: entry.label })),
      points: result.rows.map(normaliseRow),
    };
  } catch (err) {
    logger.warn({ err, trend: trend.key }, 'Admin analytics trend failed');
    return { key: trend.key, label: trend.label, series: [], points: [], error: true };
  }
}

async function runBreakdown(db, breakdown, since, until) {
  try {
    const filter = breakdown.filter ? `AND (${breakdown.filter})` : '';
    const result = await db.query(
      `SELECT ${breakdown.groupBy} AS label, count(*)::int AS value
         FROM ${breakdown.from}
        WHERE ${breakdown.date} >= $1 AND ${breakdown.date} <= $2 ${filter}
          AND ${breakdown.groupBy} IS NOT NULL
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT ${BREAKDOWN_LIMIT}`,
      [since.toISOString(), until.toISOString()],
    );
    return {
      key: breakdown.key,
      label: breakdown.label,
      items: result.rows.map((row) => ({ label: row.label, value: toNumber(row.value) })),
    };
  } catch (err) {
    logger.warn({ err, breakdown: breakdown.key }, 'Admin analytics breakdown failed');
    return { key: breakdown.key, label: breakdown.label, items: [], error: true };
  }
}

export function createConsoleAnalyticsService({ db }) {
  async function overview({ sectionId = 'dashboard', days = DEFAULT_DAYS } = {}) {
    const rangeDays = Math.min(MAX_DAYS, Math.max(1, Number(days) || DEFAULT_DAYS));
    const until = new Date();
    const since = new Date(until.getTime() - rangeDays * 24 * 60 * 60 * 1000);

    const definition = DEFINITIONS[sectionId] || fallbackDefinition(sectionId) || DEFINITIONS.dashboard;

    const [cards, trends, breakdowns] = await Promise.all([
      Promise.all((definition.cards || []).map((card) => runCard(db, card))),
      Promise.all((definition.trends || []).map((trend) => runTrend(db, trend, since, until))),
      Promise.all((definition.breakdowns || []).map((breakdown) => runBreakdown(db, breakdown, since, until))),
    ]);

    return {
      sectionId,
      range: { days: rangeDays, from: since.toISOString(), to: until.toISOString() },
      cards,
      trends,
      breakdowns,
    };
  }

  return { overview };
}

export default createConsoleAnalyticsService;
