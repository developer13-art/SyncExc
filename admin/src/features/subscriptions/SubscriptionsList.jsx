import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Receipt, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { usePagination } from '../../hooks/usePagination.js';
import { subscriptionsApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '../../lib/formatters/date.formatter.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'cancel_scheduled', label: 'Cancel scheduled' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'expired', label: 'Expired' },
];

const STATUS_VARIANTS = {
  active: 'success',
  past_due: 'destructive',
  cancel_scheduled: 'warning',
  canceled: 'muted',
  expired: 'destructive',
  pending: 'muted',
  grace_period: 'warning',
  suspended: 'destructive',
};

export default function SubscriptionsList() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Subscriptions'));
    dispatch(
      adminUiActions.setBreadcrumbs([
        { label: 'Subscriptions', path: '/subscriptions' },
      ]),
    );
  }, [dispatch]);

  const subscriptionsQuery = useQuery({
    queryKey: ['subscriptions', { status, query, page: pagination.page }],
    queryFn: () =>
      subscriptionsApi.list({
        status: status === 'all' ? undefined : status,
        q: query || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const subscriptions = subscriptionsQuery.data?.items ?? [];

  if (subscriptionsQuery.data?.meta?.total !== undefined) {
    pagination.setTotal(subscriptionsQuery.data.meta.total);
  }

  const columns = [
    {
      key: 'id',
      label: 'Subscription',
      render: (row) => (
        <Link
          to={`/subscriptions/${row.id}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.id?.slice(0, 12) ?? '—'}
        </Link>
      ),
    },
    {
      key: 'planName',
      label: 'Plan',
      render: (row) => <span className="text-sm text-foreground">{row.planName ?? '—'}</span>,
    },
    {
      key: 'ownerLabel',
      label: 'Owner',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.ownerLabel ?? '—'}</span>
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
      key: 'price',
      label: 'Price',
      align: 'right',
      render: (row) =>
        row.price !== undefined
          ? formatCurrency(row.price, row.currency ?? 'USD')
          : '—',
    },
    {
      key: 'currentPeriodEnd',
      label: 'Renews',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.currentPeriodEnd ? formatDate(row.currentPeriodEnd) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Subscriptions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inspect subscription lifecycle states, entitlements, and billing references. Manual
          corrections use controlled, auditable operations.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search subscriptions…"
          className="w-full max-w-xs"
        />
        <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
        <IconButton
          label="Refresh"
          onClick={() => subscriptionsQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw
            className={subscriptionsQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      {subscriptionsQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : subscriptions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No subscriptions match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={subscriptions} />

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