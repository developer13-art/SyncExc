import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { DollarSign, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { usePagination } from '../../hooks/usePagination.js';
import { paymentsApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'disputed', label: 'Disputed' },
];

const STATUS_VARIANTS = {
  succeeded: 'success',
  pending: 'warning',
  processing: 'warning',
  failed: 'destructive',
  refunded: 'muted',
  partially_refunded: 'warning',
  disputed: 'destructive',
};

export default function PaymentsList() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Payments'));
    dispatch(adminUiActions.setBreadcrumbs([{ label: 'Payments', path: '/payments' }]));
  }, [dispatch]);

  const paymentsQuery = useQuery({
    queryKey: ['payments', { status, query, page: pagination.page }],
    queryFn: () =>
      paymentsApi.list({
        status: status === 'all' ? undefined : status,
        q: query || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const payments = paymentsQuery.data?.items ?? [];

  if (paymentsQuery.data?.meta?.total !== undefined) {
    pagination.setTotal(paymentsQuery.data.meta.total);
  }

  const columns = [
    {
      key: 'id',
      label: 'Payment',
      render: (row) => (
        <Link
          to={`/payments/${row.id}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.id?.slice(0, 12) ?? '—'}
        </Link>
      ),
    },
    {
      key: 'providerReference',
      label: 'Provider ref',
      render: (row) => (
        <span className="font-mono text-2xs text-muted-foreground">
          {row.providerReference?.slice(0, 16) ?? '—'}
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
      key: 'providerStatus',
      label: 'Provider',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.providerStatus] ?? 'muted'}>
          {row.providerStatus ?? '—'}
        </Badge>
      ),
    },
    {
      key: 'internalStatus',
      label: 'Internal',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.internalStatus] ?? 'muted'}>
          {row.internalStatus ?? '—'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search and inspect payment records. Provider status and internal processing status are
          shown separately when they differ.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by payment ID, provider ref, or owner…"
          className="w-full max-w-md"
        />
        <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
        <IconButton
          label="Refresh"
          onClick={() => paymentsQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw
            className={paymentsQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      {paymentsQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <DollarSign className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No payments match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={payments} />

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