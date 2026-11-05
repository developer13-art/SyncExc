import { useEffect, useMemo, useState } from 'react';
import { Activity, Camera, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { officialTraderApi } from '../../api/index.js';
import { getErrorMessage } from '../../lib/errors.js';
import { useToast } from '../../hooks/useToast.js';
import { formatDate, formatDateTime } from '../../lib/formatters/date.formatter.js';
import { PageHeader } from './components/PageHeader.jsx';
import { PerformanceChart } from './components/PerformanceChart.jsx';
import { useOfficialTraderPage } from './hooks/useOfficialTraderPage.js';
import {
  formatMoney,
  formatPercentValue,
  formatPrice,
  humanize,
  statusVariant,
} from './official-trader.utils.js';

export default function OfficialPerformance() {
  useOfficialTraderPage('Performance');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState({ start: '', end: '' });
  const [asset, setAsset] = useState('');

  const performanceQuery = useQuery({
    queryKey: ['official-trader', 'performance', period],
    queryFn: () => officialTraderApi.performance({
      periodStart: period.start || undefined,
      periodEnd: period.end || undefined,
    }),
  });

  const snapshotMutation = useMutation({
    mutationFn: () => officialTraderApi.snapshot({
      periodStart: period.start ? new Date(period.start).toISOString() : undefined,
      periodEnd: period.end ? new Date(`${period.end}T23:59:59Z`).toISOString() : undefined,
    }),
    onSuccess: () => {
      toast.success('Performance snapshot stored');
      queryClient.invalidateQueries({ queryKey: ['official-trader'] });
    },
    onError: (error) => toast.error('Snapshot failed', { description: getErrorMessage(error) }),
  });

  const data = performanceQuery.data;
  const metrics = data?.metrics;

  const seriesAssets = useMemo(
    () => Object.keys(data?.seriesByAsset ?? {}),
    [data?.seriesByAsset],
  );

  useEffect(() => {
    if (seriesAssets.length > 0 && !seriesAssets.includes(asset)) {
      setAsset(seriesAssets[0]);
    }
  }, [asset, seriesAssets]);

  if (performanceQuery.isLoading) {
    return <LoadingState label="Loading official performance" />;
  }
  if (performanceQuery.isError) {
    return (
      <ErrorState
        title="Performance unavailable"
        description={getErrorMessage(performanceQuery.error)}
        onRetry={performanceQuery.refetch}
      />
    );
  }

  const assetSeries = data?.seriesByAsset?.[asset];
  const points = assetSeries?.all ?? assetSeries ?? [];

  const closureColumns = [
    {
      key: 'closed_at',
      label: 'Closed',
      render: (row) => (
        <div>
          <p className="text-sm text-foreground">{formatDateTime(row.closed_at)}</p>
          <p className="text-xs text-muted-foreground">{row.instrument} · {humanize(row.market_type)}</p>
        </div>
      ),
    },
    {
      key: 'side',
      label: 'Side',
      render: (row) => <Badge variant="outline">{humanize(row.execution_side)}</Badge>,
    },
    {
      key: 'entry_exit',
      label: 'Entry / exit',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatPrice(row.entry_price)} → {formatPrice(row.exit_price)}
        </span>
      ),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (row) => formatPrice(row.quantity),
    },
    {
      key: 'fees',
      label: 'Fees',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{formatMoney(row.fees)} {row.fee_asset || ''}</span>
      ),
    },
    {
      key: 'outcome',
      label: 'Outcome',
      render: (row) => (
        <Badge variant={statusVariant(row.outcome)}>{humanize(row.outcome)}</Badge>
      ),
    },
    {
      key: 'pnl',
      label: 'Net PnL',
      align: 'right',
      render: (row) => (
        <span className={Number(row.realized_pnl) >= 0 ? 'text-success' : 'text-destructive'}>
          {formatMoney(row.realized_pnl)} {row.pnl_asset || ''}
        </span>
      ),
    },
  ];

  const snapshotColumns = [
    {
      key: 'period',
      label: 'Period',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.period_start)} → {formatDate(row.period_end)}
        </span>
      ),
    },
    {
      key: 'closed',
      label: 'Closed trades',
      render: (row) => row.metrics?.totals?.closedTrades ?? row.metrics?.closedTrades ?? '—',
    },
    {
      key: 'winRate',
      label: 'Win rate',
      render: (row) => formatPercentValue(row.metrics?.totals?.winRate ?? row.metrics?.winRate),
    },
    {
      key: 'created_at',
      label: 'Stored',
      render: (row) => formatDateTime(row.created_at),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Performance"
        description="Performance is calculated exclusively from exchange-reconciled executions and closed-trade attribution. Analyses, backtests, simulations, and open positions are never presented as realized results."
      >
        <IconButton label="Refresh performance" onClick={() => performanceQuery.refetch()} className="border border-border">
          <RefreshCw className={performanceQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
        <Button variant="outline" onClick={() => snapshotMutation.mutate()} disabled={snapshotMutation.isPending}>
          <Camera className="h-4 w-4" />
          {snapshotMutation.isPending ? 'Storing…' : 'Store snapshot'}
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-medium">
          Period start
          <input
            type="date"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={period.start}
            onChange={(event) => setPeriod((current) => ({ ...current, start: event.target.value }))}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Period end
          <input
            type="date"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={period.end}
            onChange={(event) => setPeriod((current) => ({ ...current, end: event.target.value }))}
          />
        </label>
        <Button
          variant="outline"
          onClick={() => setPeriod({ start: '', end: '' })}
          disabled={!period.start && !period.end}
        >
          Clear period
        </Button>
        <Badge variant="muted">
          {data?.period?.start || data?.period?.end
            ? `Filtered ${formatDate(data.period.start)} → ${formatDate(data.period.end)}`
            : 'All reconciled history'}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Closed trades"
          value={metrics?.closedTrades ?? 0}
          hint={`${metrics?.wins ?? 0} wins · ${metrics?.losses ?? 0} losses · ${metrics?.breakeven ?? 0} breakeven`}
          icon={Activity}
        />
        <StatCard
          label="Win rate"
          value={formatPercentValue(metrics?.winRate)}
          hint="Eligible closed trades only"
          icon={TrendingUp}
        />
        <StatCard
          label="Realized PnL"
          value={formatMoney(metrics?.realizedPnl)}
          hint={`Fees ${formatMoney(metrics?.fees)}`}
          icon={TrendingDown}
        />
        <StatCard
          label="Average win / loss"
          value={`${formatMoney(metrics?.averageWin)} / ${formatMoney(metrics?.averageLoss)}`}
          hint="Per closed trade, exchange-reported"
          icon={Activity}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Open positions" value={data?.open?.openPositions ?? 0} hint="Reported separately, not realized" />
        <StatCard label="Open notional" value={formatMoney(data?.open?.openNotional)} hint="At average fill price" />
        <StatCard
          label="Last closed"
          value={metrics?.lastClosedAt ? formatDateTime(metrics.lastClosedAt) : '—'}
          hint="Most recent exchange-reconciled closure"
        />
      </div>

      <Alert
        variant="info"
        title="Methodology"
        description={data?.methodology?.description}
      >
        <p className="text-xs text-muted-foreground">{data?.methodology?.exclusions}</p>
        <p className="mt-1 text-xs text-muted-foreground">{data?.methodology?.feesNote}</p>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Cumulative realized PnL</CardTitle>
            <CardDescription>Separated by settlement asset. Never mixes spot and futures.</CardDescription>
          </div>
          {seriesAssets.length > 1 ? (
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={asset}
              onChange={(event) => setAsset(event.target.value)}
            >
              {seriesAssets.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          ) : null}
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <PerformanceChart points={points} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>By market type</CardTitle></CardHeader>
          <CardContent className="p-5 pt-0">
            <DataTable
              columns={[
                { key: 'marketType', label: 'Market', render: (row) => humanize(row.marketType) },
                { key: 'closedTrades', label: 'Closed', align: 'right' },
                { key: 'winRate', label: 'Win rate', align: 'right', render: (row) => formatPercentValue(row.winRate) },
                { key: 'realizedPnl', label: 'Realized PnL', align: 'right', render: (row) => formatMoney(row.realizedPnl) },
                { key: 'fees', label: 'Fees', align: 'right', render: (row) => formatMoney(row.fees) },
              ]}
              rows={data?.byMarketType ?? []}
              emptyTitle="No closed trades"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>By settlement asset</CardTitle></CardHeader>
          <CardContent className="p-5 pt-0">
            <DataTable
              columns={[
                { key: 'asset', label: 'Asset' },
                { key: 'closedTrades', label: 'Closed', align: 'right' },
                { key: 'winRate', label: 'Win rate', align: 'right', render: (row) => formatPercentValue(row.winRate) },
                { key: 'realizedPnl', label: 'Realized PnL', align: 'right', render: (row) => formatMoney(row.realizedPnl) },
                { key: 'fees', label: 'Fees', align: 'right', render: (row) => formatMoney(row.fees) },
              ]}
              rows={data?.byAsset ?? []}
              emptyTitle="No realized results"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent reconciled closures</CardTitle>
          <CardDescription>Corrections are auditable; this table never overwrites exchange records.</CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={closureColumns}
            rows={data?.recentClosures ?? []}
            emptyTitle="No reconciled closures"
            emptyDescription="Closures appear after an exchange reports a closed position and attribution is verified."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stored snapshots</CardTitle>
          <CardDescription>Snapshots preserve reconciled figures for audit and period review.</CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={snapshotColumns}
            rows={data?.snapshots ?? []}
            emptyTitle="No snapshots stored"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Analysis lifecycle counts</CardTitle></CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="flex flex-wrap gap-2">
            {Object.entries(data?.analysisCounts ?? {}).map(([status, count]) => (
              <Badge key={status} variant={statusVariant(status)}>
                {humanize(status)}: {count}
              </Badge>
            ))}
            {Object.keys(data?.analysisCounts ?? {}).length === 0 ? (
              <span className="text-sm text-muted-foreground">No analyses recorded.</span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
