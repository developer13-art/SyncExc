import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, Check, Workflow } from 'lucide-react';

import { marketplaceApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ROUTES } from '../../config/routes.config.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { useToast } from '../../hooks/useToast.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { MarketplaceNavigation } from './components/MarketplaceNavigation.jsx';

const TABS = ['Overview', 'Performance', 'Backtesting', 'Rules', 'Markets', 'Reviews'];

export default function MarketplaceStrategyDetails() {
  const { strategyId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Overview');
  const strategyQuery = useQuery({
    queryKey: ['marketplace', 'strategy', strategyId],
    queryFn: () => marketplaceApi.getStrategy(strategyId),
    enabled: Boolean(strategyId),
    staleTime: 30_000,
  });
  const strategy = strategyQuery.data;

  useEffect(() => {
    if (!strategy) return;
    dispatch(uiActions.setPageTitle(strategy.name));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
      { label: 'Strategies', path: ROUTES.app.marketplace.strategies },
      { label: strategy.name, path: ROUTES.app.marketplace.strategy(strategy.id) },
    ]));
  }, [dispatch, strategy]);

  const followMutation = useMutation({
    mutationFn: () => strategy.viewerIsFollowing
      ? marketplaceApi.unfollowStrategy(strategy.id)
      : marketplaceApi.followStrategy(strategy.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['marketplace', 'strategy', strategyId] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace', 'strategies'] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace', 'strategy-follows'] }),
      ]);
      toast.success(strategy.viewerIsFollowing ? 'Strategy removed from watchlist' : 'Strategy added to watchlist');
    },
    onError: (error) => toast.error('Could not update watchlist', { description: getErrorMessage(error) }),
  });
  const subscribeMutation = useMutation({
    mutationFn: () => marketplaceApi.createSubscription({
      providerId: strategy.providerId,
      ...(strategy.providerPlanId ? { planId: strategy.providerPlanId } : {}),
    }),
    onSuccess: (result) => {
      if (result?.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      toast.success('Subscription activated');
    },
    onError: (error) => toast.error('Subscription could not be started', { description: getErrorMessage(error) }),
  });

  if (strategyQuery.isLoading) return <LoadingState label="Loading strategy" />;
  if (strategyQuery.isError || !strategy) {
    return (
      <ErrorState
        title="Strategy unavailable"
        description={getErrorMessage(strategyQuery.error) || 'This strategy could not be found.'}
        onRetry={strategyQuery.refetch}
      />
    );
  }

  const plan = strategy.pricing;
  const price = plan
    ? Number(plan.amountMinor) === 0
      ? 'Free'
      : `${formatCurrency(Number(plan.amountMinor) / 100, plan.currency)} / ${plan.billingInterval || 'month'}`
    : 'No plan required';

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <MarketplaceNavigation active="strategies" />
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link to={ROUTES.app.marketplace.strategies}>
          <ArrowLeft className="h-4 w-4" /> Back to strategies
        </Link>
      </Button>

      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-5 p-5 pt-5 sm:p-7 sm:pt-7 lg:flex-row lg:items-start">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Workflow className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{strategy.name}</h1>
              <Badge variant="muted">{strategy.category}</Badge>
              <Badge variant="success"><Check className="mr-1 h-3 w-3" /> Published</Badge>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{strategy.description}</p>
            <Link
              to={ROUTES.app.marketplace.provider(strategy.providerId)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
            >
              <Avatar
                src={strategy.providerAvatarUrl}
                fallback={strategy.providerName?.slice(0, 1) || 'T'}
                size="sm"
              />
              {strategy.providerName || 'Trader'}
              {strategy.providerHandle ? <span className="text-muted-foreground">@{strategy.providerHandle}</span> : null}
            </Link>
            <div className="mt-4 flex flex-wrap gap-2">
              {(strategy.supportedMarkets || []).map((market) => (
                <Badge key={market} variant="outline">{market}</Badge>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col">
            <Button
              type="button"
              variant="outline"
              disabled={followMutation.isPending}
              onClick={() => followMutation.mutate()}
            >
              <Bookmark className="h-4 w-4" />
              {strategy.viewerIsFollowing ? 'Following' : 'Follow'}
            </Button>
            <Button
              type="button"
              disabled={subscribeMutation.isPending}
              onClick={() => subscribeMutation.mutate()}
            >
              {subscribeMutation.isPending ? 'Subscribing…' : `Subscribe · ${price}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Followers" value={strategy.followerCount} />
        <Stat label="Active deployments" value={strategy.deploymentCount} />
        <Stat label="Supported markets" value={strategy.supportedMarkets?.length ?? 0} />
        <Stat label="Listed" value={strategy.createdAt ? new Date(strategy.createdAt).toLocaleDateString() : '—'} />
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Strategy details">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'Overview' ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
          <Card>
            <CardHeader><CardTitle>Strategy description</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>{strategy.description}</p>
              <p>
                This listing runs from a versioned automation workflow. Execution is subject to
                your workspace permissions, destination account status, exchange support, and
                risk controls.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Strategy details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail label="Category" value={strategy.category} />
              <Detail label="Markets" value={(strategy.supportedMarkets || []).join(', ') || '—'} />
              <Detail label="Subscription" value={price} />
              <Detail label="Followers" value={Number(strategy.followerCount || 0).toLocaleString()} />
            </CardContent>
          </Card>
        </div>
      ) : activeTab === 'Markets' ? (
        <Card>
          <CardHeader><CardTitle>Supported markets</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(strategy.supportedMarkets || []).length ? strategy.supportedMarkets.map((market) => (
              <Badge key={market} variant="outline">{market}</Badge>
            )) : <p className="text-sm text-muted-foreground">No markets are listed.</p>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
            <EmptyState
              icon={Workflow}
              title={`${activeTab} data is not available`}
              description="This strategy listing does not currently include verified data for this section. We do not display estimated or provider-invented performance."
              size="sm"
              className="border-0 bg-transparent py-4"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
