import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { subscriptionsApi } from '../../api/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDate, formatDateTime } from '../../lib/formatters/date.formatter.js';

export default function SubscriptionDetails() {
  const { subscriptionId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [creditOpen, setCreditOpen] = useState(false);
  const [credit, setCredit] = useState({ amount: '', reason: '' });

  const subQuery = useQuery({
    queryKey: ['subscription', subscriptionId],
    queryFn: () => subscriptionsApi.get(subscriptionId),
    enabled: Boolean(subscriptionId),
  });

  const historyQuery = useQuery({
    queryKey: ['subscription', subscriptionId, 'history'],
    queryFn: () => subscriptionsApi.history(subscriptionId, { pageSize: 50 }),
    enabled: Boolean(subscriptionId),
  });

  const creditMutation = useMutation({
    mutationFn: () => subscriptionsApi.applyCredit(subscriptionId, credit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId, 'history'] });
      toast.success('Credit applied');
      setCreditOpen(false);
      setCredit({ amount: '', reason: '' });
    },
    onError: (err) => {
      toast.error('Failed to apply credit', { description: getErrorMessage(err) });
    },
  });

  useEffect(() => {
    if (subQuery.data) {
      dispatch(adminUiActions.setPageTitle(`Subscription · ${subQuery.data.id?.slice(0, 12)}`));
      dispatch(
        adminUiActions.setBreadcrumbs([
          { label: 'Subscriptions', path: '/subscriptions' },
          {
            label: subQuery.data.id?.slice(0, 12) ?? 'Subscription',
            path: `/subscriptions/${subscriptionId}`,
          },
        ]),
      );
    }
  }, [subQuery.data, dispatch, subscriptionId]);

  if (subQuery.isLoading) {
    return <LoadingState label="Loading subscription" />;
  }

  if (subQuery.error || !subQuery.data) {
    return (
      <ErrorState
        title="Unable to load subscription"
        description="This subscription could not be retrieved."
        onRetry={subQuery.refetch}
      />
    );
  }

  const subscription = subQuery.data;
  const history = historyQuery.data?.items ?? [];

  const statusVariant = {
    active: 'success',
    past_due: 'destructive',
    cancel_scheduled: 'warning',
    canceled: 'muted',
    expired: 'destructive',
    pending: 'muted',
    grace_period: 'warning',
    suspended: 'destructive',
  }[subscription.status] ?? 'muted';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/subscriptions">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Subscription {subscription.id?.slice(0, 12)}
            </h1>
            <Badge variant={statusVariant}>
              {subscription.status?.replace(/_/g, ' ') ?? 'unknown'}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">
            {subscription.id}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreditOpen(true)}>
            Apply credit
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Plan" value={subscription.planName ?? '—'} />
          <Field label="Plan version" value={subscription.planVersion ?? '—'} />
          <Field
            label="Price"
            value={
              subscription.price !== undefined
                ? formatCurrency(subscription.price, subscription.currency ?? 'USD')
                : '—'
            }
          />
          <Field
            label="Billing interval"
            value={subscription.billingInterval ?? 'month'}
          />
          <Field
            label="Current period"
            value={
              subscription.currentPeriodStart && subscription.currentPeriodEnd
                ? `${formatDate(subscription.currentPeriodStart)} – ${formatDate(subscription.currentPeriodEnd)}`
                : '—'
            }
          />
          <Field
            label="Next renewal"
            value={
              subscription.nextBillingAt ? formatDate(subscription.nextBillingAt) : '—'
            }
          />
          <Field label="Owner" value={subscription.ownerLabel ?? '—'} />
          <Field
            label="Cancel at period end"
            value={subscription.cancelAtPeriodEnd ? 'Yes' : 'No'}
          />
        </CardContent>
      </Card>

      {subscription.entitlements ? (
        <Card>
          <CardHeader>
            <CardTitle>Entitlements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {Object.entries(subscription.entitlements).map(([key, value]) => (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="font-mono text-xs text-foreground">{key}</span>
                  <Badge variant={value ? 'success' : 'muted'}>
                    {typeof value === 'boolean' ? (value ? 'granted' : 'not granted') : String(value)}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No history recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((event, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {event.description ?? event.type}
                    </p>
                    {event.actorName ? (
                      <p className="mt-0.5 text-2xs text-muted-foreground">
                        by {event.actorName}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {event.occurredAt ? formatDateTime(event.occurredAt) : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Modal
        open={creditOpen}
        onOpenChange={setCreditOpen}
        title="Apply credit"
        description="Apply a controlled credit to this subscription. The operation is audited."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreditOpen(false)} disabled={creditMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => creditMutation.mutate()}
              disabled={creditMutation.isPending || !credit.amount || !credit.reason}
            >
              {creditMutation.isPending ? 'Applying…' : 'Apply credit'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Amount" htmlFor="credit-amount" required>
            <Input
              id="credit-amount"
              type="text"
              inputMode="decimal"
              value={credit.amount}
              onChange={(e) => setCredit({ ...credit, amount: e.target.value })}
              placeholder="10.00"
            />
          </FormField>
          <FormField label="Reason" htmlFor="credit-reason" required>
            <Textarea
              id="credit-reason"
              rows={3}
              value={credit.reason}
              onChange={(e) => setCredit({ ...credit, reason: e.target.value })}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}