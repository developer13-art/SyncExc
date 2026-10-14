import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Plus, Wallet } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { PayoutStatusBadge } from '../../components/domain/referral/PayoutStatusBadge.jsx';
import { PayoutRequestForm } from './components/PayoutRequestForm.jsx';
import { usePayouts, usePayoutMethods, useReferralDashboard } from '../../hooks/useReferrals.js';
import { usePagination } from '../../hooks/usePagination.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Payouts() {
  const dispatch = useDispatch();
  const toast = useToast();
  const pagination = usePagination({ initialPageSize: 25 });

  const [requestOpen, setRequestOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const payoutsQuery = usePayouts({
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const methodsQuery = usePayoutMethods();
  const dashboardQuery = useReferralDashboard();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Payouts'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Referral', path: ROUTES.app.referral.dashboard },
        { label: 'Payouts', path: ROUTES.app.referral.payouts },
      ]),
    );
  }, [dispatch]);

  const payouts = payoutsQuery.payouts ?? [];

  if (payoutsQuery.meta?.total !== undefined) {
    pagination.setTotal(payoutsQuery.meta.total);
  }

  const handleRequest = async (values) => {
    setSubmitting(true);
    try {
      await payoutsQuery.requestPayout({
        methodId: values.methodId,
        amount: values.amount,
        notes: values.notes || undefined,
      });
      toast.success('Payout requested', {
        description: 'You will be notified once the request is reviewed.',
      });
      setRequestOpen(false);
    } catch (err) {
      toast.error('Request failed', { description: getErrorMessage(err) });
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'createdAt',
      label: 'Requested',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatRelativeTime(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Payout',
      render: (row) => (
        <Link
          to={ROUTES.app.referral.payout(row.id)}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.id?.slice(0, 12) ?? '—'}
        </Link>
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
      render: (row) => <PayoutStatusBadge status={row.status} />,
    },
    {
      key: 'method',
      label: 'Method',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.methodLabel ?? '—'}</span>
      ),
    },
  ];

  const dashboard = dashboardQuery.data ?? {};
  const methods = methodsQuery.methods ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payouts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Request payouts against your payable balance. Payouts are confirmed only after the
            provider completes the transfer.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.referral.dashboard}>Dashboard</Link>
          </Button>
          <Button onClick={() => setRequestOpen(true)} disabled={methods.length === 0}>
            <Plus className="h-4 w-4" /> Request payout
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5 pt-5">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Payable balance
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {formatCurrency(dashboard.payableBalance ?? 0, dashboard.currency ?? 'USD')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 pt-5">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Pending payouts
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {formatCurrency(dashboard.pendingPayouts ?? 0, dashboard.currency ?? 'USD')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 pt-5">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Paid lifetime
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {formatCurrency(dashboard.paidLifetime ?? 0, dashboard.currency ?? 'USD')}
            </p>
          </CardContent>
        </Card>
      </div>

      {payoutsQuery.isLoading ? (
        <LoadingState label="Loading payouts" />
      ) : payoutsQuery.isError ? (
        <ErrorState
          title="Unable to load payouts"
          description="We could not fetch your payouts."
          onRetry={payoutsQuery.refetch}
        />
      ) : payouts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No payouts yet"
          description="Request your first payout once your payable balance meets the minimum."
        />
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={payouts} />
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

      <Modal
        open={requestOpen}
        onOpenChange={setRequestOpen}
        title="Request a payout"
        description="Provide the amount and select a payout method."
      >
        <PayoutRequestForm
          methods={methods}
          payableBalance={dashboard.payableBalance ?? 0}
          currency={dashboard.currency ?? 'USD'}
          minimumPayout={dashboard.minimumPayout}
          onSubmit={handleRequest}
          onCancel={() => setRequestOpen(false)}
          isSubmitting={submitting}
        />
      </Modal>
    </div>
  );
}