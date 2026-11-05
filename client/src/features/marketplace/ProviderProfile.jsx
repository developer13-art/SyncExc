import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, ShieldCheck, Users } from 'lucide-react';

import { getErrorMessage, isNotFoundError } from '../../api/errors.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { ProviderSignals } from './ProviderSignals.jsx';
import { ProviderPerformance } from './ProviderPerformance.jsx';
import { ProviderDisclosures } from './ProviderDisclosures.jsx';
import { PerformanceChart } from './components/PerformanceChart.jsx';
import { SubscribeDialog } from './components/SubscribeDialog.jsx';
import { PlanCard } from '../../components/domain/subscription/PlanCard.jsx';
import { useMarketplaceProvider } from '../../hooks/useMarketplace.js';
import { useToast } from '../../hooks/useToast.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';
import { apiConfig } from '../../config/api.config.js';
import { resolveProfileImageUrl } from '../../lib/profile-image-url.js';
import { formatPercent } from '../../lib/formatters/percent.formatter.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDate } from '../../lib/formatters/date.formatter.js';

export default function ProviderProfile() {
  const { providerId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();

  const providerQuery = useMarketplaceProvider(providerId);
  const { provider, plans, isLoading, error } = providerQuery;

  const [subscribePlan, setSubscribePlan] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [failedCoverImageUrl, setFailedCoverImageUrl] = useState(null);

  useEffect(() => {
    if (provider) {
      dispatch(uiActions.setPageTitle(provider.displayName));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
          {
            label: provider.displayName,
            path: ROUTES.app.marketplace.provider(provider.id),
          },
        ]),
      );
    }
  }, [provider, dispatch]);

  if (isLoading) {
    return <LoadingState label="Loading provider" />;
  }

  if (error || !provider) {
    const providerNotFound = isNotFoundError(error);
    return (
      <ErrorState
        title={providerNotFound ? 'Provider not found' : 'Unable to load provider'}
        description={providerNotFound
          ? 'This provider profile is no longer available. Browse traders to find a current profile.'
          : getErrorMessage(error)}
        onRetry={providerNotFound ? undefined : providerQuery.refetch}
        action={providerNotFound ? (
          <Button asChild>
            <Link to={ROUTES.app.marketplace.traders}>Browse traders</Link>
          </Button>
        ) : null}
      />
    );
  }

  const initials = provider.displayName?.slice(0, 1)?.toUpperCase() || '?';
  const performance = providerQuery.performance;
  const metrics = performance?.metrics ?? {};
  const viewerSubscription = provider.viewerSubscription;

  const handleSubscribe = async ({ planId }, { rethrow = true } = {}) => {
    setSubscribing(true);
    try {
      const result = await providerQuery.subscribe({ planId });
      const redirectUrl = result?.redirectUrl ?? result?.checkoutUrl;
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }
      const requestedPlan = plans.find((plan) => plan.id === planId) ?? subscribePlan;
      const paidPlanAmount = Number(
        requestedPlan?.pricing?.amountMinor ?? (requestedPlan?.price ?? 0) * 100,
      );
      const returnedPlanId = result?.planId ?? result?.plan_id;
      if (paidPlanAmount > 0 && returnedPlanId !== requestedPlan?.id) {
        throw new Error('Payment checkout was not started. Please try again or contact support.');
      }
      toast.success('Subscribed');
      setSubscribePlan(null);
    } catch (err) {
      toast.error('Subscription failed', { description: getErrorMessage(err) });
      if (rethrow) throw err;
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.marketplace.browse}>
            <ArrowLeft className="h-4 w-4" /> Back to Traders
          </Link>
        </Button>
      </div>

      <Card>
        {provider.coverImageUrl && provider.coverImageUrl !== failedCoverImageUrl ? (
          <img
            src={resolveProfileImageUrl(
              provider.coverImageUrl,
              apiConfig.baseURL,
              window.location.origin,
            )}
            alt=""
            className="h-48 w-full rounded-t-xl object-cover"
            onError={() => setFailedCoverImageUrl(provider.coverImageUrl)}
          />
        ) : null}
        <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
            <Avatar src={provider.avatarUrl} fallback={initials} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {provider.displayName}
                </h1>
                {provider.platformOwned ? (
                  <Badge variant="info"><ShieldCheck className="mr-1 h-3 w-3" /> Official</Badge>
                ) : null}
                {provider.moderationState === 'approved' ? (
                  <Badge variant="success"><Check className="mr-1 h-3 w-3" /> Verified</Badge>
                ) : (
                  <Badge variant="warning">{provider.moderationState?.replaceAll('_', ' ') || 'Review pending'}</Badge>
                )}
                {provider.visibility !== 'public' ? (
                  <Badge variant="muted">{provider.visibility}</Badge>
                ) : null}
              </div>

              {provider.handle ? (
                <p className="mt-1 text-sm text-muted-foreground">@{provider.handle}</p>
              ) : null}

            {provider.biography ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{provider.biography}</p> : null}

            {provider.platformOwned ? (
              <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
                Published trades link to verified execution records, and performance is calculated from
                reconciled exchange fills. Research-only analyses, backtests and simulations are excluded
                from realized results.
              </p>
            ) : null}

            {provider.supportedMarkets?.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {provider.supportedMarkets.map((market) => (
                  <Badge key={market} variant="outline">{market}</Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 xl:flex-col">
            <Button asChild>
              <Link to={`${ROUTES.app.marketplace.createCopyConfiguration}?provider=${provider.id}`}>
                <Copy className="h-4 w-4" /> Copy trader
              </Link>
            </Button>
          </div>
        </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ProfileStat
        label="Win rate"
        value={metrics.winRate == null ? '—' : formatPercent(metrics.winRate, { already100: true, decimals: 1 })}
        />
        <ProfileStat label="Followers" value={provider.followerCount == null ? '—' : Number(provider.followerCount).toLocaleString()} />
        <ProfileStat label="Closed trades" value={Number(metrics.observedExecutions || 0).toLocaleString()} />
        <ProfileStat label="Signals" value={Number(provider.signalCount || metrics.totalSignals || 0).toLocaleString()} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="performance">Performance</TabsTrigger>
        <TabsTrigger value="signals">Signals</TabsTrigger>
        <TabsTrigger value="followers">Followers</TabsTrigger>
        <TabsTrigger value="subscription">Subscription</TabsTrigger>
        <TabsTrigger value="disclosures">Disclosures</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
          <PerformanceChart
            performance={performance}
            isLoading={providerQuery.performanceIsLoading}
            error={providerQuery.performanceError}
            onRetry={providerQuery.refetchPerformance}
          />
          <Card>
            <CardHeader><CardTitle>Trading statistics</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <ProfileDetail label="Closed executions" value={Number(metrics.observedExecutions || 0).toLocaleString()} />
              <ProfileDetail label="Win rate" value={metrics.winRate == null ? '—' : formatPercent(metrics.winRate, { already100: true, decimals: 1 })} />
              <ProfileDetail label="Average R:R" value={metrics.averageRR == null ? '—' : Number(metrics.averageRR).toFixed(2)} />
              <ProfileDetail label="Maximum drawdown" value={metrics.maxDrawdown == null ? '—' : formatPercent(metrics.maxDrawdown, { already100: true, decimals: 1 })} />
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                Statistics are calculated from linked closed trades. Missing values are not estimated.
              </p>
            </CardContent>
          </Card>
          </div>
        {provider.methodology ? (
          <Card className="mt-4">
            <CardHeader><CardTitle>Trading methodology</CardTitle></CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">{provider.methodology}</CardContent>
          </Card>
        ) : null}
        </TabsContent>
        <TabsContent value="performance">
        <ProviderPerformance providerId={provider.id} />
        </TabsContent>
        <TabsContent value="signals">
          <ProviderSignals
            providerId={provider.id}
          onSubscribe={() => {
            if (plans.length > 0) setSubscribePlan(plans[0]);
            else handleSubscribe({}, { rethrow: false });
          }}
        />
        </TabsContent>
        <TabsContent value="followers">
        <Card>
          <CardHeader><CardTitle>Followers</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {Number(provider.followerCount || 0).toLocaleString()} people follow this trader.
            Individual follower details are private.
          </CardContent>
        </Card>
        </TabsContent>
        <TabsContent value="subscription">
        {viewerSubscription?.status === 'active' ? (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">Subscribed</p>
                  <Badge variant="success">Active</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {viewerSubscription.planName || 'Provider plan'}
                  {viewerSubscription.price != null
                    ? ` · ${formatCurrency(viewerSubscription.price, viewerSubscription.currency)}`
                    : ''}
                </p>
                {viewerSubscription.currentPeriodEnd ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {viewerSubscription.cancelAtPeriodEnd ? 'Access through ' : 'Renews '}
                    {formatDate(viewerSubscription.currentPeriodEnd)}
                  </p>
                ) : null}
              </div>
              <Button variant="outline" asChild>
                <Link to={ROUTES.app.marketplace.subscriptions}>Manage subscription</Link>
              </Button>
            </CardContent>
          </Card>
        ) : viewerSubscription?.status === 'subscription_pending' ? (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-medium text-foreground">Payment confirmation pending</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your subscription will activate as soon as the payment is confirmed.
                </p>
              </div>
              {viewerSubscription.planId ? (
                <Button
                  variant="outline"
                  disabled={subscribing}
                  onClick={() => handleSubscribe({ planId: viewerSubscription.planId }, { rethrow: false })}
                >
                  {subscribing ? 'Preparing checkout…' : 'Get new payment link'}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : viewerSubscription?.status === 'past_due' ? (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-medium text-foreground">Subscription payment past due</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Update or retry your payment from your subscription settings.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to={ROUTES.app.marketplace.subscriptions}>Manage subscription</Link>
              </Button>
            </CardContent>
          </Card>
        ) : plans.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={{
                  ...plan,
                  features: (plan.features ?? []).map((feature) =>
                    typeof feature === 'string' ? { label: feature } : feature,
                  ),
                }}
                onSelect={() => setSubscribePlan(plan)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <p className="text-sm text-muted-foreground">This trader offers a free subscription.</p>
              <Button disabled={subscribing} onClick={() => handleSubscribe({}, { rethrow: false })}>
                {subscribing ? 'Subscribing…' : 'Subscribe'}
              </Button>
            </CardContent>
          </Card>
        )}
        </TabsContent>
        <TabsContent value="disclosures">
        <ProviderDisclosures providerId={provider.id} />
        </TabsContent>
      </Tabs>

      <SubscribeDialog
        open={Boolean(subscribePlan)}
        onOpenChange={(open) => !open && setSubscribePlan(null)}
        provider={provider}
        plan={subscribePlan}
        onConfirm={handleSubscribe}
        isSubmitting={subscribing}
      />
    </div>
  );
}

function ProfileStat({ label, value }) {
  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function ProfileDetail({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}