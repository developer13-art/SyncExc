import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ExternalLink, RefreshCw, XCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { SubscriptionStatusBadge } from '../../components/domain/subscription/SubscriptionStatusBadge.jsx';
import { useSubscription } from '../../hooks/useSubscription.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDate } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Subscription() {
  const dispatch = useDispatch();
  const toast = useToast();
  const subscription = useSubscription();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Subscription'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Billing', path: ROUTES.app.billing.overview },
        { label: 'Subscription', path: ROUTES.app.billing.subscription },
      ]),
    );
  }, [dispatch]);

  const handleCancel = async () => {
    setProcessing(true);
    try {
      await subscription.cancelSubscription({ reason: 'User requested cancellation' });
      toast.success('Cancellation scheduled', {
        description: 'Access continues until the end of the current period.',
      });
      setCancelOpen(false);
    } catch (err) {
      toast.error('Cancellation failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  const handleReactivate = async () => {
    setProcessing(true);
    try {
      await subscription.reactivate({});
      toast.success('Subscription reactivated');
    } catch (err) {
      toast.error('Reactivation failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  if (subscription.isLoading) {
    return <LoadingState label="Loading subscription" />;
  }

  const sub = subscription.subscription;

  if (!sub) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            You don't have an active subscription.
          </p>
          <Button asChild>
            <Link to={ROUTES.app.billing.plans}>Browse plans</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isCancellable = sub.status === 'active' || sub.status === 'past_due';
  const isCancelScheduled = sub.status === 'cancel_scheduled';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {sub.planName ?? 'Subscription'}
            </h1>
            <SubscriptionStatusBadge status={sub.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatCurrency(sub.price, sub.currency, { showSymbol: true })} /{' '}
            {sub.billingInterval ?? 'month'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.billing.plans}>
              <ArrowUpRight className="h-4 w-4" /> Change plan
            </Link>
          </Button>
          {isCancelScheduled ? (
            <Button onClick={handleReactivate} disabled={processing}>
              <RefreshCw className="h-4 w-4" /> Reactivate
            </Button>
          ) : isCancellable ? (
            <Button
              variant="outline"
              onClick={() => setCancelOpen(true)}
              disabled={processing}
            >
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5 pt-5">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Current period
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {sub.currentPeriodStart ? formatDate(sub.currentPeriodStart) : '—'} –{' '}
              {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 pt-5">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Next renewal
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {sub.nextBillingAt ? formatDate(sub.nextBillingAt) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 pt-5">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Payment method
            </p>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium text-foreground">
              {sub.paymentMethodSummary ?? '—'}
              {sub.paymentMethodUpdateUrl ? (
                <a
                  href={sub.paymentMethodUpdateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </p>
          </CardContent>
        </Card>
      </div>

      {subscription.entitlements && Object.keys(subscription.entitlements).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Entitlements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {Object.entries(subscription.entitlements).map(([key, value]) => (
                <li key={key} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                  <Badge variant={value ? 'success' : 'muted'}>
                    {typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : value}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel subscription?"
        description={
          sub.currentPeriodEnd
            ? `Your subscription will remain active until ${formatDate(sub.currentPeriodEnd)}, then will not renew. Existing configurations are not deleted.`
            : 'Your subscription will not renew. Existing configurations are not deleted.'
        }
        confirmLabel="Confirm cancellation"
        variant="destructive"
        onConfirm={handleCancel}
        isLoading={processing}
      />
    </div>
  );
}