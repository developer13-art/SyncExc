import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { RefreshCw, Repeat } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { usePagination } from '../../hooks/usePagination.js';
import { refundsApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'requested', label: 'Requested' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_VARIANTS = {
  requested: 'warning',
  under_review: 'warning',
  approved: 'info',
  processing: 'info',
  completed: 'success',
  failed: 'destructive',
  rejected: 'destructive',
  canceled: 'muted',
};

export default function RefundsList() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Refunds'));
    dispatch(adminUiActions.setBreadcrumbs([{ label: 'Refunds', path: '/refunds' }]));
  }, [dispatch]);

  const refundsQuery = useQuery({
    queryKey: ['refunds', { status, query, page: pagination.page }],
    queryFn: () =>
      refundsApi.list({
        status: status === 'all' ? undefined : status,
        q: query || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const refunds = refundsQuery.data?.items ?? [];

  useEffect(() => {
    const total = refundsQuery.data?.meta?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [refundsQuery.data?.meta?.total, pagination.setTotal]);

  const columns = [
    {
      key: 'id',
      label: 'Refund',
      render: (row) => (
        <Link
          to={`/refunds/${row.id}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.id?.slice(0, 12) ?? '—'}
        </Link>
      ),
    },
    {
      key: 'paymentId',
      label: 'Payment',
      render: (row) => (
        <span className="font-mono text-2xs text-muted-foreground">
          {row.paymentId?.slice(0, 12) ?? '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-foreground">
          {formatCurrency(row.amount, row.currency ?? 'USD')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'muted'}>
          {row.status?.replace(/_/g, ' ') ?? 'unknown'}
        </Badge>
      ),
    },
    {
      key: 'requestedBy',
      label: 'Requested by',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.requestedBy ?? '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Requested',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatDateTime(row.createdAt) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Refunds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Refund requests and outcomes. Approval and completion are distinct states. Provider
          confirmation determines the final outcome.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search refunds…"
          className="w-full max-w-xs"
        />
        <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
        <IconButton
          label="Refresh"
          onClick={() => refundsQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw
            className={refundsQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      {refundsQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : refunds.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Repeat className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No refunds match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={refunds} />

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