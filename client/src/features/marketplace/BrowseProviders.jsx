import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bookmark, ChartNoAxesCombined, Search, Store, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { useMarketplaceProviders } from '../../hooks/useMarketplace.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { marketplaceApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { MarketplaceNavigation } from './components/MarketplaceNavigation.jsx';
import { MarketplaceStrategyCard } from './components/MarketplaceStrategyCard.jsx';
import { MarketplaceTraderCard } from './components/MarketplaceTraderCard.jsx';

export default function BrowseProviders() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { activeWorkspace } = useWorkspaceContext();
  const [query, setQuery] = useState('');
  const {
    providers,
    isLoading,
    error,
    refetch,
    follow,
    unfollow,
  } = useMarketplaceProviders({ limit: 12 });
  const followsQuery = useQuery({
    queryKey: queryKeys.marketplace.follows({}),
    queryFn: () => marketplaceApi.listFollows({}),
    retry: false,
  });
  const strategiesQuery = useQuery({
    queryKey: queryKeys.marketplace.strategies({ limit: 4 }),
    queryFn: () => marketplaceApi.listStrategies({ limit: 4 }),
    staleTime: 60_000,
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('SyncExc Marketplace'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
      ]),
    );
  }, [dispatch]);

  const featuredProviders = useMemo(() => providers.slice(0, 4), [providers]);
  const followedIds = new Set((followsQuery.data?.items ?? []).map((item) =>
    item.provider?.id ?? item.providerId ?? item.provider_id,
  ));
  const strategies = Array.isArray(strategiesQuery.data) ? strategiesQuery.data.slice(0, 3) : [];
  const submitSearch = (event) => {
    event.preventDefault();
    navigate(`${ROUTES.app.marketplace.traders}${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <MarketplaceNavigation active="discover" />
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-semibold text-primary">Discover · Follow · Trade</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            SyncExc Marketplace
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Discover traders, strategy workflows, and reliable signals. Review performance and
            execution details before you follow, subscribe, or copy.
          </p>
          <form onSubmit={submitSearch} className="mt-5 flex max-w-xl gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search marketplace</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search traders, strategies, markets…"
                className="h-11 bg-background pl-9"
              />
            </label>
            <Button type="submit" className="h-11 px-5">Search</Button>
          </form>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-8 hidden h-64 w-64 items-center justify-center rounded-full bg-primary/10 text-primary/25 sm:flex">
          <ChartNoAxesCombined className="h-40 w-40" strokeWidth={1} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Marketplace shortcuts">
        <Shortcut to={ROUTES.app.marketplace.traders} icon={Users} title="Traders" description="Browse trader profiles" />
        <Shortcut to={ROUTES.app.marketplace.strategies} icon={ChartNoAxesCombined} title="Strategies" description="Explore published workflows" />
        <Shortcut to={ROUTES.app.marketplace.signalProviders} icon={Store} title="Signal providers" description="View live signal publishers" />
        <Shortcut to={ROUTES.app.marketplace.watchlist} icon={Bookmark} title="Watchlist" description="Your followed providers and strategies" />
      </section>

      {error ? (
        <ErrorState
          title="Unable to load providers"
          description="We could not fetch the marketplace."
          onRetry={refetch}
        />
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <SectionHeading
              title="Featured traders"
              subtitle="Independent profiles with recent marketplace activity"
              to={ROUTES.app.marketplace.traders}
            />
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
            ) : featuredProviders.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {featuredProviders.map((provider) => (
                  <MarketplaceTraderCard
                    key={provider.id}
                    provider={provider}
                    isFollowing={followedIds.has(provider.id)}
                    onFollow={async (providerId) => {
                      try {
                        await follow({ providerId });
                        toast.success('Trader added to your watchlist');
                      } catch (followError) {
                        toast.error('Could not follow trader', { description: followError.message });
                      }
                    }}
                    onUnfollow={async (providerId) => {
                      try {
                        await unfollow(providerId);
                        toast.success('Trader removed from your watchlist');
                      } catch (unfollowError) {
                        toast.error('Could not unfollow trader', { description: unfollowError.message });
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Store}
                title="No traders yet"
                description="Public trader profiles will appear here when they are approved."
              />
            )}
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeading
              title="Trending strategies"
              subtitle="Published from validated automation workflows"
              to={ROUTES.app.marketplace.strategies}
            />
            {strategiesQuery.isError ? (
              <ErrorState
                title="Strategies are unavailable"
                description="The strategy catalog could not be loaded."
                onRetry={strategiesQuery.refetch}
              />
            ) : strategiesQuery.isLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
            ) : strategies.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {strategies.map((strategy) => (
                  <MarketplaceStrategyCard key={strategy.id} strategy={strategy} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <p className="text-sm text-muted-foreground">
                    No strategies have been published yet.
                  </p>
                  {activeWorkspace?.type === 'trader' ? (
                    <Button asChild size="sm">
                      <Link to={ROUTES.app.trader.createListing}>Create a listing</Link>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </section>
        </>
      )}

      {activeWorkspace?.type === 'trader' ? (
        <div className="flex justify-end">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.trader.marketplace}>Open My Marketplace</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Shortcut({ to, icon: Icon, title, description }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm transition hover:bg-muted/50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}

function SectionHeading({ title, subtitle, to }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <Link to={to} className="shrink-0 text-sm font-medium text-primary hover:underline">
        View all
      </Link>
    </div>
  );
}