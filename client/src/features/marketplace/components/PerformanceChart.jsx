import { useState } from 'react';

import { ChartContainer } from '../../../components/charts/ChartContainer.jsx';
import { AreaChart } from '../../../components/charts/AreaChart.jsx';
import { SegmentedControl } from '../../../components/navigation/SegmentedControl.jsx';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';

const RANGE_OPTIONS = [
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '1y', label: '1y' },
  { value: 'all', label: 'All' },
];

export function PerformanceChart({ performance, currency = 'USD', isLoading, error, onRetry }) {
  const [range, setRange] = useState('90d');
  const [selectedAsset, setSelectedAsset] = useState('');

  const assets = Object.keys(performance?.seriesByAsset ?? {});
  const asset = assets.includes(selectedAsset) ? selectedAsset : assets[0];
  const series = asset ? performance.seriesByAsset[asset]?.[range] ?? [] : [];

  return (
    <ChartContainer
      title="Realized performance"
      subtitle="Cumulative realized PnL from exactly linked closed trades. Past outcomes do not guarantee future results."
      actions={(
        <div className="flex flex-wrap items-center gap-2">
          {assets.length > 1 ? (
            <select
              aria-label="PnL settlement asset"
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
              value={asset}
              onChange={(event) => setSelectedAsset(event.target.value)}
            >
              {assets.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          ) : null}
          <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
        </div>
      )}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={series.length === 0}
      emptyTitle="No exact performance data"
      emptyDescription="Realized performance appears after a closed trade is linked to a provider signal or copied execution."
      height={320}
    >
      <AreaChart
        title={null}
        subtitle={null}
        data={series}
        dataKeys={[{ key: 'value', label: 'Cumulative PnL', color: 'hsl(var(--primary))' }]}
        xKey="timestamp"
        height={300}
        showLegend={false}
        valueFormatter={(v) => formatCurrency(v, asset === 'UNKNOWN' ? '' : asset || currency)}
        className="border-0 shadow-none"
      />
    </ChartContainer>
  );
}