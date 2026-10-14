import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ProgressBar } from '../../components/ui/ProgressBar.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SubscriptionStatusBadge } from '../../components/domain/subscription/SubscriptionStatusBadge.jsx';
import { useSubscription } from '../../hooks/useSubscription.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { cn } from '../../lib/utils/cn.util.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Usage() {
  const dispatch = useDispatch();
  const subscription = useSubscription();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Usage'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Billing', path: ROUTES.app.billing.overview },
        { label: 'Usage', path: ROUTES.app.billing.usage },
      ]),
    );
  }, [dispatch]);

  if (subscription.isLoading) {
    return <LoadingState label="Loading usage" />;
  }

  const usage = subscription.usage;
  const metrics = usage?.metrics ?? [];
  const subscriptionData = subscription.subscription;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Usage</h1>
            {subscriptionData?.status ? (
              <SubscriptionStatusBadge status={subscriptionData.status} />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Current period usage against your plan's allowances. Counters reset at the start of
            each billing period.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={ROUTES.app.billing.subscription}>Manage subscription</Link>
        </Button>
      </div>

      {metrics.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No usage metrics are configured for this plan.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Usage metrics</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {metrics.map((metric) => {
              const percent =
                metric.limit > 0
                  ? Math.min(100, (metric.used / metric.limit) * 100)
                  : metric.used > 0
                    ? 100
                    : 0;
              return (
                <div key={metric.key}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-foreground">{metric.label}</span>
                    <span className="text-muted-foreground">
                      {metric.used} / {metric.limit}
                    </span>
                  </div>
                  <ProgressBar
                    value={percent}
                    indicatorClassName={cn(
                      percent >= 90 && 'bg-destructive',
                      percent >= 75 && percent < 90 && 'bg-warning',
                    )}
                  />
                  {percent >= 90 ? (
                    <p className="mt-1 text-2xs text-destructive">
                      Approaching limit — consider upgrading before further use.
                    </p>
                  ) : percent >= 75 ? (
                    <p className="mt-1 text-2xs text-warning">
                      You are using {percent.toFixed(0)}% of this allowance.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          Reaching a usage limit restricts new usage of the affected resource. Existing records
          and configurations are preserved — they are not deleted.
        </CardContent>
      </Card>
    </div>
  );
}