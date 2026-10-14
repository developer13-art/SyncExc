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

  const series = performance?.series?.[range] ?? performance?.series?.all ?? [];

  return (
    <ChartContainer
      title="Historical performance"
      subtitle="Observations calculated under documented methodology. Past outcomes do not guarantee future results."
      actions={<SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={series.length === 0}
      emptyTitle="No performance data"
      emptyDescription="Performance history will appear once sufficient observed signals exist."
      height={320}
    >
      <AreaChart
        title={null}
        subtitle={null}
        data={series}
        dataKeys={[{ key: 'value', label: 'Equity', color: 'hsl(var(--primary))' }]}
        xKey="timestamp"
        height={300}
        showLegend={false}
        valueFormatter={(v) => formatCurrency(v, currency)}
        className="border-0 shadow-none"
      />
    </ChartContainer>
  );
}