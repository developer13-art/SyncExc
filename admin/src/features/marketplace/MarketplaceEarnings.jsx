import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { marketplaceEarningsApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { usePagination } from '../../hooks/usePagination.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'all', label: 'All' },
];

export default function MarketplaceEarnings() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [earningToPay, setEarningToPay] = useState(null);
  const [payoutReference, setPayoutReference] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const pagination = usePagination({ initialPageSize: 25 });
  const params = {
    status: status === 'all' ? undefined : status,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };

  const earningsQuery = useQuery({
    queryKey: queryKeys.marketplaceEarnings.list(params),
    queryFn: () => marketplaceEarningsApi.list(params),
  });
  const earnings = earningsQuery.data?.items ?? [];
  const totals = earningsQuery.data?.totals ?? [];

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Trader earnings'));
    dispatch(adminUiActions.setBreadcrumbs([
      { label: 'Billing', path: '/payments' },
      { label: 'Trader earnings', path: '/marketplace/earnings' },
    ]));
  }, [dispatch]);

  useEffect(() => {
    const total = earningsQuery.data?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [earningsQuery.data?.total, pagination.setTotal]);

  const handleMarkPaid = async () => {
    if (!earningToPay || !payoutReference.trim()) {
      setSubmitError('Enter the payout transfer reference.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await marketplaceEarningsApi.markPaid(earningToPay.id, {
        payoutReference: payoutReference.trim(),
        note: note.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace-earnings'] });
      toast.success('Trader payout recorded');
      setEarningToPay(null);
      setPayoutReference('');
      setNote('');
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const closePayoutDialog = () => {
    if (submitting) return;
    setEarningToPay(null);
    setPayoutReference('');
    setNote('');
    setSubmitError(null);
  };

  const columns = [
    {
      key: 'trader',
      label: 'Trader',
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.provider_name}</p>
          <p className="text-xs text-muted-foreground">{row.trader_email}</p>
        </div>
      ),
    },
    {
      key: 'gross',
      label: 'Subscription paid',
      align: 'right',
      render: (row) => formatCurrency(Number(row.gross_amount_minor) / 100, row.currency),
    },
    {
      key: 'share',
      label: 'Trader balance',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-foreground">
          {formatCurrency(Number(row.trader_net_amount_minor) / 100, row.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'paid' ? 'success' : row.status === 'pending' ? 'warning' : 'muted'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'reference',
      label: 'Payout reference',
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.payout_reference || '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Payment date',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.created_at ? formatDateTime(row.created_at) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => row.status === 'pending' ? (
        <Button size="sm" onClick={() => setEarningToPay(row)}>Record payout</Button>
      ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Trader earnings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review verified subscription payments, outstanding trader balances, and manually recorded payouts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {totals.map((total) => (
          <Card key={total.currency}>
            <CardHeader><CardTitle>{total.currency} balance</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="font-semibold text-foreground">
                  {formatCurrency(total.pendingMinor / 100, total.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="font-semibold text-foreground">
                  {formatCurrency(total.paidMinor / 100, total.currency)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SegmentedControl
        options={STATUS_FILTERS}
        value={status}
        onChange={(value) => {
          setStatus(value);
          pagination.goToPage(1);
        }}
      />

      {earningsQuery.isLoading ? (
        <LoadingState label="Loading trader earnings" />
      ) : earningsQuery.isError ? (
        <ErrorState
          title="Trader earnings unavailable"
          description={getErrorMessage(earningsQuery.error)}
          onRetry={earningsQuery.refetch}
        />
      ) : (
        <Card>
          <CardContent className="p-5">
            <DataTable
              columns={columns}
              rows={earnings}
              emptyTitle="No trader earnings"
              emptyDescription="Verified marketplace subscription payments will appear here."
            />
            {pagination.total > pagination.pageSize ? (
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrev}
                  onClick={pagination.prevPage}
                >
                  Previous
                </Button>
                <span className="self-center text-xs text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNext}
                  onClick={pagination.nextPage}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Modal
        open={Boolean(earningToPay)}
        onOpenChange={(open) => {
          if (!open) closePayoutDialog();
        }}
        title="Record trader payout"
        description={earningToPay
          ? `${earningToPay.provider_name} · ${formatCurrency(Number(earningToPay.trader_net_amount_minor) / 100, earningToPay.currency)}`
          : ''}
        footer={
          <>
            <Button variant="outline" onClick={closePayoutDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleMarkPaid} disabled={submitting || !payoutReference.trim()}>
              {submitting ? 'Recording…' : 'Confirm payout'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Transfer reference
            <Input
              value={payoutReference}
              onChange={(event) => setPayoutReference(event.target.value)}
              maxLength={200}
              required
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Note (optional)
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
            />
          </label>
          {submitError ? <p className="text-xs text-destructive" role="alert">{submitError}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
