import { Badge as StatusBadge } from '../../components/ui/Badge.jsx';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Alert } from '../../components/ui/Alert.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { officialTraderApi } from '../../api/index.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { PageHeader } from './components/PageHeader.jsx';
import { useOfficialTraderPage } from './hooks/useOfficialTraderPage.js';
import {
  formatMoney,
  formatPrice,
  humanize,
  statusVariant,
} from './official-trader.utils.js';

function pricingLabel(pricing) {
  if (!pricing || typeof pricing !== 'object') return '—';
  if (pricing.amount != null) {
    return `${formatMoney(pricing.amount)} ${pricing.currency || ''}`.trim();
  }
  if (pricing.price != null) {
    return `${formatMoney(pricing.price)} ${pricing.currency || ''}`.trim();
  }
  return Object.keys(pricing).length ? JSON.stringify(pricing) : 'Free';
}

export default function MarketplaceManagement() {
  useOfficialTraderPage('Marketplace management');

  const marketplaceQuery = useQuery({
    queryKey: ['official-trader', 'marketplace'],
    queryFn: officialTraderApi.marketplace,
  });

  if (marketplaceQuery.isLoading) {
    return <LoadingState label="Loading official marketplace presence" />;
  }
  if (marketplaceQuery.isError) {
    return (
      <ErrorState
        title="Marketplace data unavailable"
        description={getErrorMessage(marketplaceQuery.error)}
        onRetry={marketplaceQuery.refetch}
      />
    );
  }

  const data = marketplaceQuery.data;
  const provider = data?.provider;
  const summary = data?.summary ?? {};

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Marketplace management"
        description="The Official SyncExc AI Trader is a platform-owned provider. Its marketplace identity, plans, and published signals are managed here; performance comes from verified execution records."
      >
        <IconButton
          label="Refresh marketplace data"
          onClick={() => marketplaceQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw className={marketplaceQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {provider?.displayName || 'SyncExc Official AI Trader'}
            <StatusBadge variant="info">Official</StatusBadge>
          </p>
          <p className="text-xs text-muted-foreground">
            @{provider?.handle || 'syncexc-official'} · {humanize(provider?.visibility)} · {humanize(provider?.moderationState)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Published signals" value={summary.signals ?? 0} hint={`${summary.closed_signals ?? 0} closed`} />
        <StatCard label="Active subscribers" value={summary.active_subscriptions ?? 0} hint={`${summary.pending_subscriptions ?? 0} pending`} />
        <StatCard label="Active plans" value={summary.active_plans ?? 0} hint="Official marketplace plans" />
        <StatCard
          label="Copy executions"
          value={summary.copy_executions ?? 0}
          hint={`${summary.filled_copy_executions ?? 0} filled`}
        />
      </div>

      <Alert
        variant="info"
        title="Publication is execution-verified"
        description="Only analyses that passed validation, were accepted by an exchange, produced at least one confirmed fill, and reconciled with stop-loss and targets are published. Rejected, unfilled, failed, and research-only analyses never appear as successful trades."
      />

      <Card>
        <CardHeader>
          <CardTitle>Published signals</CardTitle>
          <CardDescription>Recent verified publications linked to official executions.</CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={[
              {
                key: 'created_at',
                label: 'Published',
                render: (row) => (
                  <div>
                    <p className="text-sm text-foreground">{formatDateTime(row.created_at)}</p>
                    <p className="text-xs text-muted-foreground">{humanize(row.market_type)}</p>
                  </div>
                ),
              },
              {
                key: 'instrument',
                label: 'Signal',
                render: (row) => (
                  <div>
                    <p className="text-sm font-medium text-foreground">{row.instrument}</p>
                    <p className="text-xs text-muted-foreground">{humanize(row.direction)} · entry {formatPrice(row.entry)}</p>
                  </div>
                ),
              },
              {
                key: 'levels',
                label: 'Levels',
                render: (row) => (
                  <span className="text-xs text-muted-foreground">
                    SL {formatPrice(row.stop_loss)}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge variant={statusVariant(row.status)}>{humanize(row.status)}</StatusBadge>,
              },
              {
                key: 'execution',
                label: 'Official execution',
                render: (row) => (
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.execution_id ? row.execution_id.slice(0, 8) : '—'}
                  </span>
                ),
              },
              {
                key: 'realized_pnl',
                label: 'Realized PnL',
                align: 'right',
                render: (row) => (
                  <span className="text-xs">
                    {formatMoney(row.realized_pnl)} {row.pnl_asset || ''}
                  </span>
                ),
              },
            ]}
            rows={data?.signals?.items ?? []}
            emptyTitle="No published official signals"
            emptyDescription="Signals appear after a verified official execution is reconciled."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Official plans</CardTitle>
          <CardDescription>Subscription plans available to marketplace subscribers.</CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={[
              { key: 'name', label: 'Plan' },
              { key: 'pricing', label: 'Pricing', render: (row) => pricingLabel(row.pricing) },
              {
                key: 'entitlements',
                label: 'Entitlements',
                render: (row) => (
                  <span className="text-xs text-muted-foreground">
                    {row.entitlements && Object.keys(row.entitlements).length
                      ? Object.entries(row.entitlements).map(([key, value]) => `${humanize(key)}: ${String(value)}`).join(', ')
                      : '—'}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge variant={statusVariant(row.status)}>{humanize(row.status)}</StatusBadge>,
              },
              { key: 'created_at', label: 'Created', render: (row) => formatDateTime(row.created_at) },
            ]}
            rows={data?.plans ?? []}
            emptyTitle="No plans configured"
          />
        </CardContent>
      </Card>
    </div>
  );
}
