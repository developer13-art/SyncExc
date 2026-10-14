import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { supportApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';

const RANGE_OPTIONS = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

export default function SupportMetrics() {
  const dispatch = useDispatch();
  const [range, setRange] = useState('7d');

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Support Metrics'));
    dispatch(
      adminUiActions.setBreadcrumbs([
        { label: 'Support', path: '/support' },
        { label: 'Metrics', path: '/support/metrics' },
      ]),
    );
  }, [dispatch]);

  const metricsQuery = useQuery({
    queryKey: ['support', 'metrics', { range }],
    queryFn: () => supportApi.metrics({ range }),
  });

  if (metricsQuery.isLoading) {
    return <LoadingState label="Loading metrics" />;
  }

  const metrics = metricsQuery.data ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Support Metrics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregated service metrics. Small samples are labeled as insufficient for
            meaningful comparisons.
          </p>
        </div>
        <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Created" value={metrics.created ?? 0} />
        <StatCard label="Resolved" value={metrics.resolved ?? 0} />
        <StatCard
          label="Backlog"
          value={metrics.backlog ?? 0}
          tone={metrics.backlog > 50 ? 'warning' : 'default'}
        />
        <StatCard
          label="Reopened"
          value={metrics.reopened ?? 0}
          tone={metrics.reopened > 10 ? 'warning' : 'default'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By category</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {metrics.byCategory?.length > 0 ? (
            <ul className="divide-y divide-border">
              {metrics.byCategory.map((category) => (
                <li
                  key={category.category}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span className="text-foreground capitalize">
                    {category.category?.replace(/_/g, ' ')}
                  </span>
                  <span className="text-muted-foreground">
                    {category.count} ticket{category.count !== 1 ? 's' : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">No data in this range.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quality</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric
            label="First response (median)"
            value={
              metrics.medianFirstResponseMinutes !== undefined
                ? `${metrics.medianFirstResponseMinutes} min`
                : '—'
            }
          />
          <Metric
            label="Resolution (median)"
            value={
              metrics.medianResolutionHours !== undefined
                ? `${metrics.medianResolutionHours} h`
                : '—'
            }
          />
          <Metric
            label="Satisfaction"
            value={
              metrics.satisfactionScore !== undefined
                ? metrics.satisfactionScore.toFixed(2)
                : '—'
            }
          />
          <Metric
            label="AI-assisted"
            value={
              metrics.aiAssistRate !== undefined
                ? `${(metrics.aiAssistRate * 100).toFixed(0)}%`
                : '—'
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}