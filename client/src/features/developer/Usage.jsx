import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { useQuery } from '@tanstack/react-query';
import { developerApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatNumber } from '../../lib/formatters/number.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Usage() {
  const { applicationId } = useParams();
  const dispatch = useDispatch();
  const [range, setRange] = useState('24h');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('API Usage'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Developer', path: ROUTES.app.developer.overview },
        { label: 'Applications', path: ROUTES.app.developer.applications },
        {
          label: 'Application',
          path: ROUTES.app.developer.application(applicationId),
        },
        {
          label: 'Usage',
          path: ROUTES.app.developer.usage(applicationId),
        },
      ]),
    );
  }, [dispatch, applicationId]);

  const usageQuery = useQuery({
    queryKey: queryKeys.developer.usage(applicationId, { range }),
    queryFn: () => developerApi.getUsage(applicationId, { range }),
    enabled: Boolean(applicationId),
    refetchInterval: 30_000,
  });

  if (usageQuery.isLoading) {
    return <LoadingState label="Loading usage" />;
  }

  if (usageQuery.error || !usageQuery.data) {
    return (
      <ErrorState
        title="Unable to load usage"
        description="We could not fetch usage data for this application."
        onRetry={usageQuery.refetch}
      />
    );
  }

  const usage = usageQuery.data;

  const endpointColumns = [
    {
      key: 'method',
      label: 'Method',
      render: (row) => (
        <span className="font-mono text-2xs font-medium text-foreground">
          {row.method}
        </span>
      ),
    },
    {
      key: 'path',
      label: 'Endpoint',
      render: (row) => (
        <code className="font-mono text-xs text-foreground">{row.path}</code>
      ),
    },
    {
      key: 'requests',
      label: 'Requests',
      align: 'right',
      render: (row) => formatNumber(row.requests ?? 0, { maximumFractionDigits: 0 }),
    },
    {
      key: 'errors',
      label: 'Errors',
      align: 'right',
      render: (row) =>
        row.errors > 0 ? (
          <span className="text-destructive">{formatNumber(row.errors)}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
    {
      key: 'averageLatencyMs',
      label: 'Avg latency',
      align: 'right',
      render: (row) =>
        row.averageLatencyMs !== undefined
          ? `${row.averageLatencyMs}ms`
          : '—',
    },
    {
      key: 'rateLimitEvents',
      label: 'Rate limits',
      align: 'right',
      render: (row) =>
        row.rateLimitEvents > 0 ? (
          <span className="text-warning">{row.rateLimitEvents}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.developer.application(applicationId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            API Usage
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Request volume, errors, latency, and rate-limit events for this application.
          </p>
        </div>
        <SegmentedControl
          options={[
            { value: '1h', label: '1h' },
            { value: '24h', label: '24h' },
            { value: '7d', label: '7d' },
            { value: '30d', label: '30d' },
          ]}
          value={range}
          onChange={setRange}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total requests"
          value={formatNumber(usage.totalRequests ?? 0, { maximumFractionDigits: 0 })}
        />
        <StatCard
          label="Success rate"
          value={
            usage.successRate !== undefined
              ? `${(usage.successRate * 100).toFixed(1)}%`
              : '—'
          }
          tone={usage.successRate >= 0.99 ? 'success' : 'warning'}
        />
        <StatCard
          label="Rate-limit events"
          value={usage.rateLimitEvents ?? 0}
          tone={usage.rateLimitEvents > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Average latency"
          value={usage.averageLatencyMs !== undefined ? `${usage.averageLatencyMs}ms` : '—'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per endpoint</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={endpointColumns}
            rows={usage.endpoints ?? []}
            emptyTitle="No endpoint activity"
            emptyDescription="Endpoint activity will appear here once the application starts making requests."
          />
        </CardContent>
      </Card>
    </div>
  );
}