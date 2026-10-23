import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { usePagination } from '../../hooks/usePagination.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { getErrorMessage } from '../../api/errors.js';
import { useToast } from '../../hooks/useToast.js';

export default function CopyResults() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const toast = useToast();
  const pagination = usePagination({ initialPageSize: 25 });
  const [outcome, setOutcome] = useState('all');
  const confirmCopy = useMutation({
    mutationFn: (recordId) => marketplaceApi.confirmCopySignalResult(recordId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.copySignalResults({}) });
      toast.success(
        result.status === 'terminal_confirmation_required'
          ? 'Additional terminal risk confirmation is required'
          : result.status === 'reconciliation_required'
            ? 'Order outcome needs reconciliation; do not retry'
            : result.status === 'rejected'
              ? 'The exchange rejected this order'
            : 'Copy order submitted',
      );
    },
  });

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
          {row.errorMessage || row.skipReason?.replace(/_/g, ' ') || '—'}
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
    {
      key: 'confirmation',
      label: 'Action',
      render: (row) =>
        row.outcome === 'held' && row.intentStatus === 'confirming' ? (
          <Button size="sm" variant="outline" disabled>
            Processing…
          </Button>
        ) : row.outcome === 'held' && [
          'awaiting_confirmation',
          'terminal_confirmation_required',
        ].includes(row.intentStatus) ? (
          <Button
            size="sm"
            variant="outline"
            disabled={confirmCopy.isPending}
            onClick={() => confirmCopy.mutate(row.id)}
          >
            {row.intentStatus === 'terminal_confirmation_required'
              ? 'Approve risk & submit'
              : 'Confirm order'}
          </Button>
        ) : row.executionRequestId ? (
        <Button size="sm" variant="outline" asChild>
          <Link to={ROUTES.app.terminal.execution(row.executionRequestId)}>
            View terminal execution
          </Link>
        </Button>
      ) : null,
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
          {confirmCopy.isError ? (
            <p className="mb-3 text-sm text-destructive" role="alert">
              {getErrorMessage(confirmCopy.error)}
            </p>
          ) : null}
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