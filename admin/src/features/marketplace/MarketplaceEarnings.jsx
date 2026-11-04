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

const REQUEST_STATUS_FILTERS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const SUBSCRIPTION_STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'following', label: 'Following' },
  { value: 'subscription_pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'expired', label: 'Expired' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'access_revoked', label: 'Access revoked' },
];

const PLAN_STATUS_FILTERS = [
  { value: 'all', label: 'All plans' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'retired', label: 'Retired' },
  { value: 'archived', label: 'Archived' },
];

const VIEWS = [
  { value: 'earnings', label: 'Payments' },
  { value: 'requests', label: 'Payout requests' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'plans', label: 'Trader plans' },
];

export default function MarketplaceEarnings() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [view, setView] = useState('earnings');
  const [status, setStatus] = useState('pending');
  const [requestStatus, setRequestStatus] = useState('pending');
  const [subscriptionStatus, setSubscriptionStatus] = useState('all');
  const [planStatus, setPlanStatus] = useState('all');
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [planToUpdate, setPlanToUpdate] = useState(null);
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [planForm, setPlanForm] = useState({
    providerId: '',
    name: '',
    amount: '',
    currency: 'USD',
    billingInterval: 'monthly',
  });
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [earningToPay, setEarningToPay] = useState(null);
  const [payoutAction, setPayoutAction] = useState('paid');
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
    enabled: view === 'earnings',
  });
  const requestParams = {
    status: requestStatus === 'all' ? undefined : requestStatus,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
  const requestsQuery = useQuery({
    queryKey: ['admin', 'marketplace-payout-requests', requestParams],
    queryFn: () => marketplaceEarningsApi.listRequests(requestParams),
    enabled: view === 'requests',
  });
  const subscriptionsParams = {
    status: subscriptionStatus === 'all' ? undefined : subscriptionStatus,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
  const subscriptionsQuery = useQuery({
    queryKey: ['admin', 'marketplace-trader-subscriptions', subscriptionsParams],
    queryFn: () => marketplaceEarningsApi.listSubscriptions(subscriptionsParams),
    enabled: view === 'subscriptions',
  });
  const plansParams = {
    status: planStatus === 'all' ? undefined : planStatus,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
  const plansQuery = useQuery({
    queryKey: ['admin', 'marketplace-trader-plans', plansParams],
    queryFn: () => marketplaceEarningsApi.listPlans(plansParams),
    enabled: view === 'plans',
  });
  const tradersQuery = useQuery({
    queryKey: ['admin', 'marketplace-traders', { pageSize: 100 }],
    queryFn: () => marketplaceEarningsApi.listTraders({ pageSize: 100 }),
    enabled: view === 'plans' && createPlanOpen,
  });
  const earnings = earningsQuery.data?.items ?? [];
  const totals = earningsQuery.data?.totals ?? [];
  const requests = requestsQuery.data?.items ?? [];
  const subscriptions = subscriptionsQuery.data?.items ?? [];
  const plans = plansQuery.data?.items ?? [];
  const traders = tradersQuery.data?.items ?? [];

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Trader monetization'));
    dispatch(adminUiActions.setBreadcrumbs([
      { label: 'Billing', path: '/payments' },
      { label: 'Trader monetization', path: '/marketplace/earnings' },
    ]));
  }, [dispatch]);

  useEffect(() => {
    const total = view === 'earnings'
      ? earningsQuery.data?.total
      : view === 'requests'
        ? requestsQuery.data?.total
        : view === 'subscriptions'
          ? subscriptionsQuery.data?.total
          : plansQuery.data?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [
    view,
    earningsQuery.data?.total,
    requestsQuery.data?.total,
    subscriptionsQuery.data?.total,
    plansQuery.data?.total,
    pagination.setTotal,
  ]);

  const handleCreatePlan = async (event) => {
    event.preventDefault();
    const amountMinor = Math.round(Number(planForm.amount) * 100);
    if (!planForm.providerId || !planForm.name.trim() ||
      !Number.isSafeInteger(amountMinor) || amountMinor < 0) {
      setSubmitError('Enter a provider ID, plan name, and a valid non-negative price.');
      return;
    }
    setCreatingPlan(true);
    setSubmitError(null);
    try {
      await marketplaceEarningsApi.createPlan({
        providerId: planForm.providerId.trim(),
        name: planForm.name.trim(),
        pricing: {
          amountMinor,
          currency: planForm.currency,
          billingInterval: planForm.billingInterval,
        },
        entitlements: {},
      });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace-trader-plans'] });
      toast.success('Trader plan created', {
        description: 'The plan starts as a draft and is not visible to subscribers until activated.',
      });
      setPlanForm({
        providerId: '',
        name: '',
        amount: '',
        currency: 'USD',
        billingInterval: 'monthly',
      });
      setCreatePlanOpen(false);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setCreatingPlan(false);
    }
  };

  const handleUpdatePlanStatus = async () => {
    if (!planToUpdate) return;
    setUpdatingPlan(true);
    setSubmitError(null);
    try {
      await marketplaceEarningsApi.setPlanStatus(planToUpdate.id, planToUpdate.nextStatus);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace-trader-plans'] });
      toast.success(`Trader plan ${planToUpdate.nextStatus}`);
      setPlanToUpdate(null);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setUpdatingPlan(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!earningToPay || (payoutAction === 'paid' && !payoutReference.trim())) {
      setSubmitError('Enter the payout transfer reference.');
      return;
    }
    if (earningToPay.payoutKind === 'request' && payoutAction === 'paid' &&
      !earningToPay.payout_account_number) {
      setSubmitError('This request has no verified payout account details. Reject it so the trader can submit a new request with account details.');
      return;
    }
    if (payoutAction === 'rejected' && note.trim().length < 10) {
      setSubmitError('Provide a reason of at least 10 characters.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (earningToPay.payoutKind === 'request') {
        if (payoutAction === 'paid') {
          await marketplaceEarningsApi.markRequestPaid(earningToPay.id, {
            payoutReference: payoutReference.trim(),
            note: note.trim() || undefined,
          });
        } else {
          await marketplaceEarningsApi.rejectRequest(earningToPay.id, { note: note.trim() });
        }
        await queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace-payout-requests'] });
        await queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace-earnings'] });
        await queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace-trader-subscriptions'] });
        toast.success(payoutAction === 'paid' ? 'Payout recorded' : 'Payout request rejected');
      } else {
        await marketplaceEarningsApi.markPaid(earningToPay.id, {
          payoutReference: payoutReference.trim(),
          note: note.trim() || undefined,
        });
        await queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace-earnings'] });
        toast.success('Trader payout recorded');
      }
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

  const openPayoutDialog = (row, action = 'paid') => {
    setEarningToPay(row);
    setPayoutAction(action);
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
      key: 'subscriber',
      label: 'Subscriber',
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">
            {row.subscriber_name || row.subscriber_username || 'Subscriber'}
          </p>
          <p className="text-xs text-muted-foreground">{row.subscriber_email}</p>
        </div>
      ),
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (row) => (
        <div>
          <p className="text-foreground">{row.plan_name || 'Plan'}</p>
          <p className="text-xs text-muted-foreground">
            {row.subscription_status || 'unknown'}
            {row.current_period_end
              ? ` · until ${formatDateTime(row.current_period_end)}`
              : ''}
          </p>
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

  const requestColumns = [
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
      key: 'amount',
      label: 'Requested amount',
      align: 'right',
      render: (row) => formatCurrency(Number(row.amount_minor) / 100, row.currency),
    },
    {
      key: 'destination',
      label: 'Payout destination',
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.payout_account_name || 'Not provided'}</p>
          <p className="text-xs text-muted-foreground">
            {[row.payout_bank_name, row.payout_country_code].filter(Boolean).join(' · ') || '—'}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {row.payout_account_last4 ? `•••• ${row.payout_account_last4}` : '—'}
          </p>
        </div>
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
      key: 'created_at',
      label: 'Requested',
      render: (row) => row.created_at ? formatDateTime(row.created_at) : '—',
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => row.status === 'pending' ? (
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={() => openPayoutDialog({ ...row, payoutKind: 'request' })}>
            Record payout
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openPayoutDialog({ ...row, payoutKind: 'request' }, 'rejected')}
          >
            Reject
          </Button>
        </div>
      ) : (
        <span className="font-mono text-xs text-muted-foreground">{row.payout_reference || '—'}</span>
      ),
    },
  ];

  const subscriptionColumns = [
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
      label: 'Plan / status',
      render: (row) => (
        <div>
          <p className="text-foreground">{row.plan_name || 'Plan'}</p>
          <Badge variant={row.status === 'active' ? 'success' : 'warning'}>{row.status}</Badge>
        </div>
      ),
    },
    {
      key: 'plan_price',
      label: 'Plan price',
      align: 'right',
      render: (row) => row.pricing?.amountMinor == null
        ? '—'
        : formatCurrency(Number(row.pricing.amountMinor) / 100, row.pricing.currency || 'USD'),
    },
    {
      key: 'gross_paid',
      label: 'Subscriber paid',
      align: 'right',
      render: (row) => formatCurrency(
        Number(row.total_gross_minor) / 100,
        row.payment_currency || row.pricing?.currency || 'USD',
      ),
    },
    {
      key: 'trader_net',
      label: 'Trader net',
      align: 'right',
      render: (row) => formatCurrency(
        Number(row.total_trader_net_minor) / 100,
        row.payment_currency || row.pricing?.currency || 'USD',
      ),
    },
    {
      key: 'current_period_end',
      label: 'Expires',
      render: (row) => row.current_period_end ? formatDateTime(row.current_period_end) : '—',
    },
  ];

  const planColumns = [
    {
      key: 'name',
      label: 'Plan',
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">v{row.version}</p>
        </div>
      ),
    },
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
      key: 'price',
      label: 'Price',
      align: 'right',
      render: (row) => formatCurrency(
        Number(row.pricing?.amountMinor ?? 0) / 100,
        row.pricing?.currency || 'USD',
      ),
    },
    {
      key: 'billing',
      label: 'Billing interval',
      render: (row) => row.pricing?.billingInterval || '—',
    },
    {
      key: 'subscribers',
      label: 'Subscribers',
      align: 'right',
      render: (row) => row.subscriber_count ?? 0,
    },
    {
      key: 'commission',
      label: 'Platform commission',
      align: 'right',
      render: (row) => formatCurrency(
        Number(row.platform_commission_minor) / 100,
        row.pricing?.currency || 'USD',
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <div className="flex items-center justify-between gap-3">
          <Badge variant={row.status === 'active' ? 'success' : row.status === 'draft' ? 'warning' : 'muted'}>
            {row.status}
          </Badge>
          {row.status === 'draft' || row.status === 'retired' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPlanToUpdate({ ...row, nextStatus: 'active' })}
            >
              Activate
            </Button>
          ) : row.status === 'active' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPlanToUpdate({ ...row, nextStatus: 'retired' })}
            >
              Retire
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const selectedAmount = earningToPay
    ? Number(earningToPay.amount_minor ?? earningToPay.trader_net_amount_minor) / 100
    : 0;
  const selectedCurrency = earningToPay?.currency || 'USD';
  const activeQuery = view === 'earnings'
    ? earningsQuery
    : view === 'requests'
      ? requestsQuery
      : view === 'subscriptions'
        ? subscriptionsQuery
        : plansQuery;
  const paginationControls = pagination.total > pagination.pageSize ? (
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
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Trader monetization</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage trader plans, all marketplace subscriptions, verified earnings and payout requests.
        </p>
      </div>

      <SegmentedControl
        options={VIEWS}
        value={view}
        onChange={(value) => {
          setView(value);
          pagination.goToPage(1);
        }}
      />

      {view === 'plans' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            options={PLAN_STATUS_FILTERS}
            value={planStatus}
            onChange={(value) => {
              setPlanStatus(value);
              pagination.goToPage(1);
            }}
          />
          <Button onClick={() => {
            setSubmitError(null);
            setCreatePlanOpen(true);
          }}>
            Create trader plan
          </Button>
        </div>
      ) : null}

      {view === 'earnings' ? (
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
      ) : null}

      {view === 'earnings' ? (
        <SegmentedControl
          options={STATUS_FILTERS}
          value={status}
          onChange={(value) => {
            setStatus(value);
            pagination.goToPage(1);
          }}
        />
      ) : view === 'requests' ? (
        <SegmentedControl
          options={REQUEST_STATUS_FILTERS}
          value={requestStatus}
          onChange={(value) => {
            setRequestStatus(value);
            pagination.goToPage(1);
          }}
        />
      ) : view === 'subscriptions' ? (
        <SegmentedControl
          options={SUBSCRIPTION_STATUS_FILTERS}
          value={subscriptionStatus}
          onChange={(value) => {
            setSubscriptionStatus(value);
            pagination.goToPage(1);
          }}
        />
      ) : null}

      {activeQuery.isLoading ? (
        <LoadingState label={view === 'subscriptions' ? 'Loading subscriptions' : view === 'plans' ? 'Loading trader plans' : view === 'requests' ? 'Loading payout requests' : 'Loading trader earnings'} />
      ) : activeQuery.isError ? (
        <ErrorState
          title={view === 'subscriptions' ? 'Subscriptions unavailable' : view === 'plans' ? 'Trader plans unavailable' : view === 'requests' ? 'Payout requests unavailable' : 'Trader earnings unavailable'}
          description={getErrorMessage(activeQuery.error)}
          onRetry={activeQuery.refetch}
        />
      ) : (
        <Card>
          <CardContent className="p-5">
            <DataTable
              columns={view === 'subscriptions' ? subscriptionColumns : view === 'plans' ? planColumns : view === 'requests' ? requestColumns : columns}
              rows={view === 'subscriptions' ? subscriptions : view === 'plans' ? plans : view === 'requests' ? requests : earnings}
              emptyTitle={view === 'subscriptions' ? 'No trader subscriptions' : view === 'plans' ? 'No trader plans' : view === 'requests' ? 'No payout requests' : 'No trader earnings'}
              emptyDescription={view === 'subscriptions'
                ? 'Use the status filter to review active, cancelled, expired, failed, and pending marketplace subscriptions.'
                : view === 'plans'
                  ? 'Create draft trader subscription plans and review subscriber counts and platform commission.'
                : view === 'requests'
                  ? 'Trader payout requests will appear here for review.'
                  : 'Verified marketplace subscription payments will appear here with subscriber details.'}
            />
            {paginationControls}
          </CardContent>
        </Card>
      )}

      <Modal
        open={Boolean(planToUpdate)}
        onOpenChange={(open) => {
          if (!updatingPlan && !open) {
            setPlanToUpdate(null);
            setSubmitError(null);
          }
        }}
        title={`${planToUpdate?.nextStatus === 'active' ? 'Activate' : 'Retire'} trader plan`}
        description={planToUpdate
          ? `This changes "${planToUpdate.name}" from ${planToUpdate.status} to ${planToUpdate.nextStatus}.`
          : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setPlanToUpdate(null)} disabled={updatingPlan}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePlanStatus} disabled={updatingPlan}>
              {updatingPlan ? 'Saving…' : `Confirm ${planToUpdate?.nextStatus || 'change'}`}
            </Button>
          </>
        }
      >
        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
      </Modal>

      <Modal
        open={createPlanOpen}
        onOpenChange={(open) => {
          if (!creatingPlan) {
            setCreatePlanOpen(open);
            if (!open) setSubmitError(null);
          }
        }}
        title="Create trader subscription plan"
        description="New plans are created as drafts. Traders remain responsible for publishing and activating them."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setCreatePlanOpen(false)}
              disabled={creatingPlan}
            >
              Cancel
            </Button>
            <Button type="submit" form="create-trader-plan" disabled={creatingPlan || tradersQuery.isLoading}>
              {creatingPlan ? 'Creating…' : 'Create draft plan'}
            </Button>
          </>
        }
      >
        <form id="create-trader-plan" onSubmit={handleCreatePlan} className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Trader profile
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={planForm.providerId}
              onChange={(event) => setPlanForm((current) => ({ ...current, providerId: event.target.value }))}
              required
            >
              <option value="">Select a trader</option>
              {traders.map((trader) => (
                <option key={trader.id} value={trader.id}>
                  {trader.display_name} (@{trader.handle}) — {trader.trader_email}
                </option>
              ))}
            </select>
            {tradersQuery.isError ? (
              <span className="text-xs text-destructive">Unable to load trader profiles: {getErrorMessage(tradersQuery.error)}</span>
            ) : null}
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Plan name
            <Input
              value={planForm.name}
              onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))}
              maxLength={100}
              required
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="grid gap-1 text-sm font-medium">
              Price
              <Input
                type="number"
                min="0"
                step="0.01"
                value={planForm.amount}
                onChange={(event) => setPlanForm((current) => ({ ...current, amount: event.target.value }))}
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Currency
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={planForm.currency}
                onChange={(event) => setPlanForm((current) => ({ ...current, currency: event.target.value }))}
              >
                <option value="USD">USD</option>
                <option value="NGN">NGN</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Interval
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={planForm.billingInterval}
                onChange={(event) => setPlanForm((current) => ({ ...current, billingInterval: event.target.value }))}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
          </div>
          {submitError ? <p className="text-xs text-destructive" role="alert">{submitError}</p> : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(earningToPay)}
        onOpenChange={(open) => {
          if (!open) closePayoutDialog();
        }}
        title={payoutAction === 'rejected' ? 'Reject payout request' : 'Record trader payout'}
        description={earningToPay
          ? `${earningToPay.provider_name} · ${formatCurrency(selectedAmount, selectedCurrency)}`
          : ''}
        footer={
          <>
            <Button variant="outline" onClick={closePayoutDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleMarkPaid}
              disabled={
                submitting ||
                (payoutAction === 'paid' && !payoutReference.trim()) ||
                (payoutAction === 'rejected' && note.trim().length < 10) ||
                (earningToPay?.payoutKind === 'request' &&
                  payoutAction === 'paid' &&
                  !earningToPay.payout_account_number)
              }
            >
              {submitting
                ? payoutAction === 'paid' ? 'Recording…' : 'Rejecting…'
                : payoutAction === 'paid' ? 'Confirm payout' : 'Reject request'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {earningToPay?.payoutKind === 'request' ? (
            <div className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium text-foreground">Send payout to</p>
              <p className="mt-1 text-muted-foreground">
                {earningToPay.payout_account_name || 'Account holder unavailable'}
              </p>
              <p className="text-muted-foreground">
                {[earningToPay.payout_bank_name, earningToPay.payout_country_code].filter(Boolean).join(' · ') || 'Bank details unavailable'}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {earningToPay.payout_account_number || 'Account number unavailable'}
              </p>
            </div>
          ) : null}
          {payoutAction === 'paid' ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Transfer reference
              <Input
                value={payoutReference}
                onChange={(event) => setPayoutReference(event.target.value)}
                maxLength={200}
                required
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {payoutAction === 'rejected' ? 'Reason (required)' : 'Note (optional)'}
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              minLength={payoutAction === 'rejected' ? 10 : undefined}
            />
          </label>
          {submitError ? <p className="text-xs text-destructive" role="alert">{submitError}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
