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
import { marketplaceEarningsApi, paymentsApi } from '../../api/index.js';
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

const PAYMENT_TYPES = [
  { value: 'system', label: 'System subscriptions' },
  { value: 'trader', label: 'Trader subscriptions' },
];

const TRADER_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid out' },
  { value: 'reversed', label: 'Reversed' },
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
  const [paymentType, setPaymentType] = useState('system');
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
    enabled: paymentType === 'system',
  });
  const traderPaymentsQuery = useQuery({
    queryKey: ['payments', 'trader-subscriptions', { status, page: pagination.page }],
    queryFn: () => marketplaceEarningsApi.list({
      status: status === 'all' ? undefined : status,
      page: pagination.page,
      pageSize: pagination.pageSize,
    }),
    enabled: paymentType === 'trader',
  });

  const activeQuery = paymentType === 'system' ? paymentsQuery : traderPaymentsQuery;
  const payments = activeQuery.data?.items ?? [];

  useEffect(() => {
    const total = paymentType === 'system'
      ? paymentsQuery.data?.meta?.total
      : traderPaymentsQuery.data?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [paymentType, paymentsQuery.data?.meta?.total, traderPaymentsQuery.data?.total, pagination.setTotal]);

  const systemColumns = [
    {
      key: 'type',
      label: 'Payment type',
      render: () => <Badge variant="info">System subscription</Badge>,
    },
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

  const traderColumns = [
    {
      key: 'type',
      label: 'Payment type',
      render: () => <Badge variant="muted">Trader subscription</Badge>,
    },
    {
      key: 'trader',
      label: 'Trader',
      render: (row) => (
        <div>
          <Link to={`/workspaces/${row.workspace_id}`} className="font-medium text-primary hover:underline">
            {row.provider_name || row.provider_handle || 'Trader'}
          </Link>
          <p className="text-xs text-muted-foreground">{row.trader_email}</p>
        </div>
      ),
    },
    {
      key: 'subscriber',
      label: 'Subscriber',
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.subscriber_name || row.subscriber_username || 'Subscriber'}</p>
          <p className="text-xs text-muted-foreground">{row.subscriber_email}</p>
        </div>
      ),
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (row) => row.plan_name || '—',
    },
    {
      key: 'amount',
      label: 'Subscription amount',
      align: 'right',
      render: (row) => formatCurrency(Number(row.gross_amount_minor) / 100, row.currency ?? 'USD'),
    },
    {
      key: 'traderNet',
      label: 'Trader share',
      align: 'right',
      render: (row) => formatCurrency(Number(row.trader_net_amount_minor) / 100, row.currency ?? 'USD'),
    },
    {
      key: 'status',
      label: 'Payout status',
      render: (row) => <Badge variant={row.status === 'paid' ? 'success' : row.status === 'pending' ? 'warning' : 'muted'}>{row.status}</Badge>,
    },
    {
      key: 'created_at',
      label: 'Paid',
      align: 'right',
      render: (row) => <span className="text-xs text-muted-foreground">{row.created_at ? formatDateTime(row.created_at) : '—'}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review SyncExc system subscription payments separately from marketplace subscription
          revenue earned by traders.
        </p>
      </div>

      <SegmentedControl
        options={PAYMENT_TYPES}
        value={paymentType}
        onChange={(value) => {
          setPaymentType(value);
          setStatus('all');
          pagination.goToPage(1);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        {paymentType === 'system' ? (
          <>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search by payment ID, provider ref, or owner…"
              className="w-full max-w-md"
            />
            <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
          </>
        ) : (
          <SegmentedControl options={TRADER_STATUS_FILTERS} value={status} onChange={setStatus} />
        )}
        <IconButton
          label="Refresh"
          onClick={() => activeQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw
            className={activeQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      {activeQuery.isLoading ? (
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
            <DataTable columns={paymentType === 'system' ? systemColumns : traderColumns} rows={payments} />

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