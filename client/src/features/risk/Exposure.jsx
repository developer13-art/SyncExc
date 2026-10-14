import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { RefreshCw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { ExposureSummary } from './components/ExposureSummary.jsx';
import { useRiskExposure } from '../../hooks/useRisk.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export default function Exposure() {
  const dispatch = useDispatch();
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Exposure'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Risk', path: ROUTES.app.risk.overview },
        { label: 'Exposure', path: ROUTES.app.risk.exposure },
      ]),
    );
  }, [dispatch]);

  const exposureQuery = useRiskExposure({});

  if (exposureQuery.isLoading) {
    return <LoadingState label="Loading exposure" />;
  }

  if (exposureQuery.isError) {
    return (
      <ErrorState
        title="Unable to load exposure"
        description="We could not fetch exposure data."
        onRetry={exposureQuery.refetch}
      />
    );
  }

  const exposure = exposureQuery.data ?? {};
  const accounts = exposure.accounts ?? [];

  const columns = [
    {
      key: 'account',
      label: 'Account',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-foreground">
            {row.accountLabel ?? row.accountId}
          </p>
          <p className="text-2xs uppercase tracking-wide text-muted-foreground">
            {row.exchangeName}
          </p>
        </div>
      ),
    },
    {
      key: 'grossExposure',
      label: 'Gross',
      align: 'right',
      render: (row) => formatCurrency(row.grossExposure ?? 0, row.currency ?? 'USD'),
    },
    {
      key: 'netExposure',
      label: 'Net',
      align: 'right',
      render: (row) => formatCurrency(row.netExposure ?? 0, row.currency ?? 'USD'),
    },
    {
      key: 'pendingExposure',
      label: 'Pending',
      align: 'right',
      render: (row) => (
        <span className="text-muted-foreground">
          {formatCurrency(row.pendingExposure ?? 0, row.currency ?? 'USD')}
        </span>
      ),
    },
    {
      key: 'freshness',
      label: 'Freshness',
      render: (row) => (
        <span
          className={cn(
            'text-xs font-medium',
            row.freshness === 'current'
              ? 'text-success'
              : row.freshness === 'stale'
                ? 'text-warning'
                : 'text-destructive',
          )}
        >
          {row.freshness ?? '—'}
        </span>
      ),
    },
    {
      key: 'snapshotAt',
      label: 'Snapshot',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.snapshotAt ? formatRelativeTime(row.snapshotAt) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Exposure
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregated exposure across connected accounts. Stale or incomplete data is
            reported honestly rather than as a complete figure.
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={() => exposureQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw
            className={exposureQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      <ExposureSummary exposure={exposure} />

      <Card>
        <CardHeader>
          <CardTitle>Per-account breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-5 pt-0">
            <DataTable
              columns={columns}
              rows={accounts}
              emptyTitle="No account exposure data"
              emptyDescription="Connect exchanges and refresh to see exposure."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}