import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, CreditCard, Receipt, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs.jsx';
import { PlanCard } from './components/PlanCard.jsx';
import { PlanComparison } from './components/PlanComparison.jsx';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Plans() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const subscription = useSubscription();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Plans'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Billing', path: ROUTES.app.billing.overview },
        { label: 'Plans', path: ROUTES.app.billing.plans },
      ]),
    );
  }, [dispatch]);

  const plansQuery = useQuery({
    queryKey: queryKeys.billing.plans({}),
    queryFn: () => billingApi.listPlans({}),
    staleTime: 5 * 60_000,
  });

  const plans = plansQuery.data ?? [];
  const currentPlanId = subscription.subscription?.planId;

  const handleSelectPlan = async (plan) => {
    if (plan.id === currentPlanId) {
      return;
    }
    try {
      const checkout = await billingApi.createCheckout({ planId: plan.id });
      if (checkout?.checkoutUrl) {
        window.location.assign(checkout.checkoutUrl);
      } else if (checkout?.id) {
        navigate(ROUTES.app.billing.checkout(checkout.id));
      }
    } catch (err) {
      toast.error('Unable to start checkout', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Subscription Plans
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare plans and manage your subscription. Plan changes are versioned and preserve
            existing records.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.billing.subscription}>
              <CreditCard className="h-4 w-4" /> Manage subscription
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.billing.usage}>
              <BarChart3 className="h-4 w-4" /> Usage
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.billing.invoices}>
              <Receipt className="h-4 w-4" /> Invoices
            </Link>
          </Button>
        </div>
      </div>

      {plansQuery.isLoading ? (
        <LoadingState label="Loading plans" />
      ) : plansQuery.isError ? (
        <ErrorState
          title="Unable to load plans"
          description="We could not fetch the plan catalog."
          onRetry={plansQuery.refetch}
        />
      ) : plans.length === 0 ? (
        <EmptyState
          title="No plans available"
          description="The plan catalog is currently empty."
        />
      ) : (
        <Tabs defaultValue="cards">
          <TabsList>
            <TabsTrigger value="cards">Cards</TabsTrigger>
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
          </TabsList>
          <TabsContent value="cards">
            <div className="grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isCurrent={plan.id === currentPlanId}
                  onSelect={handleSelectPlan}
                />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="comparison">
            <PlanComparison plans={plans} currentPlanId={currentPlanId} />
          </TabsContent>
        </Tabs>
      )}

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          A successful payment does not automatically authorize every feature, and a
          subscription limit never overrides platform safety controls. Feature access is
          enforced independently by the entitlement system.
        </CardContent>
      </Card>
    </div>
  );
}