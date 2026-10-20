import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, Copy, Star, Users } from 'lucide-react';

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
import { SubscribeDialog } from './components/SubscribeDialog.jsx';
import { PlanCard } from '../../components/domain/subscription/PlanCard.jsx';
import { useMarketplaceProvider, useMarketplaceProviders } from '../../hooks/useMarketplace.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export default function ProviderProfile() {
  const { providerId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();

  const providerQuery = useMarketplaceProvider(providerId);
  const { provider, plans, isLoading, error } = providerQuery;

  const { follow, unfollow } = useMarketplaceProviders();

  const [subscribePlan, setSubscribePlan] = useState(null);
  const [subscribing, setSubscribing] = useState(false);

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
    return (
      <ErrorState
        title="Unable to load provider"
        description="This provider could not be retrieved."
        onRetry={providerQuery.refetch}
      />
    );
  }

  const isFollowing = provider.viewerIsFollowing;
  const initials = (provider.displayName ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await unfollow(provider.id);
        toast.success('Unfollowed');
      } else {
        await follow({ providerId: provider.id });
        toast.success('Following');
      }
      await providerQuery.refetch?.();
    } catch (err) {
      toast.error('Action failed', { description: getErrorMessage(err) });
    }
  };

  const handleSubscribe = async ({ planId }) => {
    setSubscribing(true);
    try {
      await providerQuery.subscribe({ planId });
      toast.success('Subscribed');
      setSubscribePlan(null);
    } catch (err) {
      toast.error('Subscription failed', { description: getErrorMessage(err) });
      throw err;
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.marketplace.browse}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 pt-6">
          <div className="flex flex-wrap items-start gap-5">
            <Avatar src={provider.avatarUrl} fallback={initials} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {provider.displayName}
                </h1>
                {provider.verified ? (
                  <Badge variant="info">Verified</Badge>
                ) : null}
                {provider.status === 'paused' ? (
                  <Badge variant="warning">Paused</Badge>
                ) : null}
              </div>

              {provider.handle ? (
                <p className="mt-1 text-sm text-muted-foreground">@{provider.handle}</p>
              ) : null}

              {provider.biography ? (
                <p className="mt-3 text-sm text-muted-foreground">{provider.biography}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-4 text-xs">
                {provider.subscriberCount !== undefined ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" /> {provider.subscriberCount.toLocaleString()}{' '}
                    subscribers
                  </span>
                ) : null}
                {provider.rating !== undefined ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Star className="h-3 w-3" /> {provider.rating.toFixed(1)}
                  </span>
                ) : null}
                {provider.signalCount !== undefined ? (
                  <span className="text-muted-foreground">
                    {provider.signalCount.toLocaleString()} signals
                  </span>
                ) : null}
              </div>

              {provider.supportedMarkets?.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {provider.supportedMarkets.map((market) => (
                    <span
                      key={market}
                      className={cn(
                        'rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground',
                      )}
                    >
                      {market}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleFollow}>
                {isFollowing ? (
                  <>
                    <BellOff className="h-4 w-4" /> Unfollow
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4" /> Follow
                  </>
                )}
              </Button>
              <Button variant="outline" asChild>
                <Link to={`${ROUTES.app.marketplace.createCopyConfiguration}?provider=${provider.id}`}>
                  <Copy className="h-4 w-4" /> Configure copying
                </Link>
              </Button>
              {plans.length > 0 ? (
                <Button onClick={() => setSubscribePlan(plans[0])}>Subscribe</Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {plans.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Plans</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={{
                  ...plan,
                  features: (plan.features ?? []).map((f) =>
                    typeof f === 'string' ? { label: f } : f,
                  ),
                }}
                onSelect={() => setSubscribePlan(plan)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <Tabs defaultValue="signals">
        <TabsList>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="disclosures">Disclosures</TabsTrigger>
        </TabsList>
        <TabsContent value="signals">
          <ProviderSignals
            providerId={provider.id}
            onSubscribe={plans.length > 0 ? () => setSubscribePlan(plans[0]) : undefined}
          />
        </TabsContent>
        <TabsContent value="performance">
          <ProviderPerformance providerId={provider.id} />
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