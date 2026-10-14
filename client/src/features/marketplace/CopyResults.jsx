import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { usePagination } from '../../hooks/usePagination.js';
import { uiActions } from '../../app/slices/uiActions.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function CopyResults() {
  const dispatch = useDispatch();
  const pagination = usePagination({ initialPageSize: 25 });
  const [outcome, setOutcome] = useState('all');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Copy Results'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
        { label: 'Results', path: ROUTES.app.marketplace.copyResults },
      ]),
    );
  }, [dispatch]);

  const resultsQuery = useQuery({
    queryKey: [
      ...queryKeys.marketplace.copySignalResults({
        outcome: outcome === 'all' ? undefined : outcome,
        page: pagination.page,
      }),
    ],
    queryFn: () =>
      marketplaceApi.listCopySignalResults({
        outcome: outcome === 'all' ? undefined : outcome,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const results = resultsQuery.data?.items ?? [];

  if (resultsQuery.data?.meta?.total !== undefined) {
    pagination.setTotal(resultsQuery.data.meta.total);
  }

  const columns = [
    {
      key: 'occurredAt',
      label: 'Time',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.occurredAt ? formatRelativeTime(row.occurredAt) : '—'}
        </span>
      ),
    },
    {
      key: 'provider',
      label: 'Provider',
      render: (row) => (
        <span className="text-sm text-foreground">{row.providerName ?? '—'}</span>
      ),
    },
    {
      key: 'instrument',
      label: 'Instrument',
      render: (row) => <span className="font-medium text-foreground">{row.instrument}</span>,
    },
    {
      key: 'outcome',
      label: 'Outcome',
      render: (row) => (
        <Badge variant={outcomeVariant(row.outcome)}>
          {row.outcome?.replace(/_/g, ' ') ?? 'unknown'}
        </Badge>
      ),
    },
    {
      key: 'skipReason',
      label: 'Reason',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.skipReason?.replace(/_/g, ' ') ?? '—'}
        </span>
      ),
    },
    {
      key: 'destination',
      label: 'Destination',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.destinationLabel ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Copy Results
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-signal, per-subscriber processing outcomes. Skipped signals are preserved with
            a clear reason.
          </p>
        </div>
        <Link
          to={ROUTES.app.marketplace.copyConfigurations}
          className="text-sm text-primary hover:underline"
        >
          Manage configurations
        </Link>
      </div>

      <SegmentedControl
        options={[
          { value: 'all', label: 'All' },
          { value: 'executed', label: 'Executed' },
          { value: 'skipped', label: 'Skipped' },
          { value: 'held', label: 'Held' },
          { value: 'failed', label: 'Failed' },
        ]}
        value={outcome}
        onChange={setOutcome}
      />

      <Card>
        <CardContent className="p-5 pt-5">
          {results.length === 0 && !resultsQuery.isLoading ? (
            <EmptyState
              icon={BarChart3}
              title="No copy results yet"
              description="Results appear as eligible signals are processed for your configurations."
              size="sm"
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={results}
                isLoading={resultsQuery.isLoading}
                emptyTitle="No results"
              />
              {pagination.total > pagination.pageSize ? (
                <div className="mt-4 flex justify-end">
                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={pagination.goToPage}
                    hasNext={pagination.hasNext}
                    hasPrev={pagination.hasPrev}
                  />
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function outcomeVariant(outcome) {
  if (outcome === 'executed' || outcome === 'completed') {
    return 'success';
  }
  if (outcome === 'failed') {
    return 'destructive';
  }
  if (outcome === 'skipped' || outcome === 'held') {
    return 'warning';
  }
  return 'muted';
}