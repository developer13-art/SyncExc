import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useQuery } from '@tanstack/react-query';
import { signalsApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { usePagination } from '../../hooks/usePagination.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Intents() {
  const dispatch = useDispatch();
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Execution Intents'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Signals', path: ROUTES.app.signals.overview },
        { label: 'Intents', path: ROUTES.app.signals.intents },
      ]),
    );
  }, [dispatch]);

  const intentsQuery = useQuery({
    queryKey: queryKeys.signals.intent(`list:${pagination.page}`),
    queryFn: () => signalsApi.listSignals({ includeIntents: true, page: pagination.page }),
  });

  const intents = intentsQuery.data?.items ?? [];

  if (intentsQuery.data?.meta?.total !== undefined) {
    pagination.setTotal(intentsQuery.data.meta.total);
  }

  const columns = [
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatRelativeTime(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Intent',
      render: (row) => (
        <Link
          to={ROUTES.app.signals.intent(row.id)}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.id?.slice(0, 12) ?? '—'}
        </Link>
      ),
    },
    {
      key: 'instrument',
      label: 'Instrument',
      render: (row) => <span className="font-medium text-foreground">{row.instrument ?? '—'}</span>,
    },
    {
      key: 'direction',
      label: 'Direction',
      render: (row) => (
        <span
          className={
            row.direction === 'long' || row.direction === 'buy'
              ? 'text-xs font-semibold uppercase text-success'
              : 'text-xs font-semibold uppercase text-destructive'
          }
        >
          {row.direction ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={statusVariant(row.status)}>{row.status ?? 'pending'}</Badge>
      ),
    },
    {
      key: 'syncGroupId',
      label: 'Sync group',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.syncGroupId ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Execution Intents
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Durable handoff requests to downstream execution workflows. An intent is not
          authorization to trade — each downstream service performs its own checks.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 pt-5">
          <DataTable
            columns={columns}
            rows={intents}
            isLoading={intentsQuery.isLoading}
            emptyTitle="No execution intents"
            emptyDescription="Intents appear here when eligible signals are handed off."
            emptyIcon={Send}
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
        </CardContent>
      </Card>
    </div>
  );
}

function statusVariant(status) {
  if (status === 'completed' || status === 'executed') {
    return 'success';
  }
  if (status === 'failed' || status === 'blocked') {
    return 'destructive';
  }
  if (status === 'pending' || status === 'awaiting_approval') {
    return 'warning';
  }
  return 'muted';
}