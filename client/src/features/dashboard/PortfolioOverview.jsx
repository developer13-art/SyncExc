import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { AreaChart } from '../../components/charts/AreaChart.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';

const RANGE_OPTIONS = [
  { value: '1d', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '1y', label: '1y' },
];

export function PortfolioOverview({ overview, isLoading, error, onRetry }) {
  const [range, setRange] = useState('7d');

  const currency = overview?.baseCurrency ?? 'USD';
  const series = overview?.equitySeries?.[range] ?? [];

  const totalValue = overview?.portfolioValue ?? 0;
  const change = overview?.equityChange?.[range];
  const changeAbsolute = change?.absolute ?? 0;
  const changePercent = change?.percent ?? 0;
  const isPositive = changeAbsolute >= 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Portfolio Value</CardTitle>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-foreground">
                {overview?.portfolioValue == null ? '—' : formatCurrency(totalValue, currency)}
              </span>
              {change ? (
                <span
                  className={
                    isPositive
                      ? 'text-sm font-medium text-success'
                      : 'text-sm font-medium text-destructive'
                  }
                >
                  {isPositive ? '+' : '-'}
                  {formatCurrency(Math.abs(changeAbsolute), currency)} (
                  {changePercent == null ? '—' : `${changePercent.toFixed(2)}%`})
                </span>
              ) : null}
            </div>
            {overview?.portfolioValueEstimated ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Estimated from the latest account balances using current exchange spot prices.
              </p>
            ) : overview?.portfolioValue == null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {overview?.unpricedAssets?.length
                  ? `Unable to value ${overview.unpricedAssets.join(', ')} in USD.`
                  : 'Asset quantities are listed by account below; no USD equity valuation is available yet.'}
              </p>
            ) : null}
          </div>
          <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <AreaChart
          title={null}
          data={series}
          dataKeys={[{ key: 'value', label: 'Portfolio', color: 'hsl(var(--primary))' }]}
          xKey="timestamp"
          height={280}
          isEmpty={series.length < 2}
          emptyDescription={
            series.length === 1
              ? 'More account balance snapshots are needed to draw portfolio history.'
              : overview?.portfolioValue != null
                ? 'The current balance is available, but no historical balance snapshots have been saved yet. History will appear as your exchange account syncs.'
                : 'Connect and sync an exchange account to start collecting portfolio history.'
          }
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
          subtitle={
            overview?.portfolioValueEstimated
              ? 'Historical balances valued at current spot prices'
              : 'Historical equity from exchange account snapshots'
          }
          showLegend={false}
          valueFormatter={(v) => formatCurrency(v, currency)}
          className="border-0 shadow-none"
        />
      </CardContent>
    </Card>
  );
}