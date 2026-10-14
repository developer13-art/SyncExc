import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, CreditCard } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Checkout() {
  const { checkoutId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const [processing, setProcessing] = useState(false);

  const checkoutQuery = useQuery({
    queryKey: queryKeys.billing.checkout(checkoutId),
    queryFn: () => billingApi.getCheckoutStatus(checkoutId),
    enabled: Boolean(checkoutId),
    refetchInterval: (data) => {
      const status = data?.state?.data?.status;
      if (status === 'completed' || status === 'failed' || status === 'expired') {
        return false;
      }
      return 5_000;
    },
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Checkout'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Billing', path: ROUTES.app.billing.overview },
        { label: 'Plans', path: ROUTES.app.billing.plans },
        { label: 'Checkout', path: ROUTES.app.billing.checkout(checkoutId) },
      ]),
    );
  }, [dispatch, checkoutId]);

  useEffect(() => {
    const status = checkoutQuery.data?.status;
    if (status === 'completed') {
      toast.success('Subscription activated');
      navigate(ROUTES.app.billing.subscription, { replace: true });
    }
  }, [checkoutQuery.data?.status, navigate, toast]);

  if (checkoutQuery.isLoading) {
    return <LoadingState label="Loading checkout" />;
  }

  if (checkoutQuery.error || !checkoutQuery.data) {
    return (
      <ErrorState
        title="Unable to load checkout"
        description="This checkout could not be retrieved."
        onRetry={checkoutQuery.refetch}
      />
    );
  }

  const checkout = checkoutQuery.data;

  const handleContinueCheckout = async () => {
    if (checkout.checkoutUrl) {
      window.location.assign(checkout.checkoutUrl);
      return;
    }
    setProcessing(true);
    try {
      await checkoutQuery.refetch();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.billing.plans}>
            <ArrowLeft className="h-4 w-4" /> Back to plans
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Complete your subscription</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium text-foreground">
                  {checkout.planName ?? '—'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(checkout.amount, checkout.currency ?? 'USD')}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Billing interval</span>
                <span className="font-medium text-foreground">
                  {checkout.billingInterval ?? 'monthly'}
                </span>
              </div>
              {checkout.tax !== undefined ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(checkout.tax, checkout.currency ?? 'USD')}
                  </span>
                </div>
              ) : null}
            </div>

            {checkout.status === 'pending' ? (
              <Alert variant="info" title="Payment pending">
                <p className="text-xs">
                  Complete payment in the provider's secure interface. Access is granted only
                  after the provider confirms the payment.
                </p>
              </Alert>
            ) : checkout.status === 'failed' ? (
              <Alert variant="destructive" title="Payment failed">
                <p className="text-xs">
                  {checkout.failureReason ?? 'The payment could not be completed.'}
                </p>
              </Alert>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" asChild>
                <Link to={ROUTES.app.billing.plans}>Cancel</Link>
              </Button>
              {checkout.status === 'pending' ? (
                <Button onClick={handleContinueCheckout} disabled={processing}>
                  {processing ? 'Checking…' : 'Continue payment'}
                </Button>
              ) : checkout.status === 'completed' ? (
                <Button asChild>
                  <Link to={ROUTES.app.billing.subscription}>
                    <CheckCircle2 className="h-4 w-4" /> View subscription
                  </Link>
                </Button>
              ) : null}
            </div>

            <p className="flex items-start gap-1.5 text-2xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              We never see or store raw card details. Payment is processed by the provider
              through its own secure interface.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}