import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Building2, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { usePagination } from '../../hooks/usePagination.js';
import { exchangesApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

const INTEGRATION_STATUS_VARIANTS = {
  planned: 'muted',
  in_development: 'muted',
  testing: 'info',
  available: 'success',
  degraded: 'warning',
  maintenance: 'warning',
  disabled: 'destructive',
};

export default function ExchangesList() {
  const dispatch = useDispatch();
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Exchange Integrations'));
    dispatch(adminUiActions.setBreadcrumbs([{ label: 'Exchanges', path: '/exchanges' }]));
  }, [dispatch]);

  const exchangesQuery = useQuery({
    queryKey: ['exchanges', { page: pagination.page }],
    queryFn: () => exchangesApi.list({ page: pagination.page, pageSize: pagination.pageSize }),
  });

  const exchanges = exchangesQuery.data?.items ?? [];

  useEffect(() => {
    const total = exchangesQuery.data?.meta?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [exchangesQuery.data?.meta?.total, pagination.setTotal]);

  const columns = [
    {
      key: 'displayName',
      label: 'Exchange',
      render: (row) => (
        <Link
          to={`/exchanges/${row.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {row.displayName ?? row.id}
        </Link>
      ),
    },
    {
      key: 'integrationStatus',
      label: 'Status',
      render: (row) => (
        <Badge variant={INTEGRATION_STATUS_VARIANTS[row.integrationStatus] ?? 'muted'}>
          {row.integrationStatus?.replace(/_/g, ' ') ?? 'unknown'}
        </Badge>
      ),
    },
    {
      key: 'adapterVersion',
      label: 'Adapter',
      render: (row) => (
        <span className="font-mono text-2xs text-foreground">
          {row.adapterVersion ?? '—'}
        </span>
      ),
    },
    {
      key: 'connectionCount',
      label: 'Connections',
      align: 'right',
      render: (row) => row.connectionCount ?? 0,
    },
    {
      key: 'failureRate24h',
      label: '24h failure rate',
      align: 'right',
      render: (row) =>
        row.failureRate24h !== undefined ? (
          <span
            className={
              row.failureRate24h > 0.1
                ? 'text-destructive'
                : row.failureRate24h > 0.02
                  ? 'text-warning'
                  : 'text-foreground'
            }
          >
            {(row.failureRate24h * 100).toFixed(2)}%
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'lastHealthCheckAt',
      label: 'Last check',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.lastHealthCheckAt ? formatRelativeTime(row.lastHealthCheckAt) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Exchange Integrations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Supported exchange adapters, capability coverage, and integration health.
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={() => exchangesQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw
            className={exchangesQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      {exchangesQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : exchanges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No exchanges registered.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={exchanges} />

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
      )}
    </div>
  );
}