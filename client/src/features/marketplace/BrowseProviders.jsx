import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChartNoAxesCombined, Search, Store, Users } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';

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
import { MarketplaceNavigation } from './components/MarketplaceNavigation.jsx';
import { MarketplaceTraderCard } from './components/MarketplaceTraderCard.jsx';

export default function BrowseProviders() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspaceContext();
  const [query, setQuery] = useState('');
  const {
    providers,
    isLoading,
    error,
    refetch,
  } = useMarketplaceProviders({ limit: 12 });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('SyncExc Marketplace'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
      ]),
    );
  }, [dispatch]);

  const featuredProviders = useMemo(() => providers.slice(0, 4), [providers]);
  const performanceQueries = useQueries({
    queries: featuredProviders.map((provider) => ({
      queryKey: queryKeys.marketplace.providerPerformance(provider.id, {}),
      queryFn: () => marketplaceApi.getProviderPerformance(provider.id),
      enabled: Boolean(provider.id),
      staleTime: 60_000,
      retry: false,
    })),
  });
  const submitSearch = (event) => {
    event.preventDefault();
    navigate(`${ROUTES.app.marketplace.traders}${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <MarketplaceNavigation active="discover" />
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-semibold text-primary">Discover · Compare · Trade</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            SyncExc Marketplace
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Discover traders and reliable signals. Review performance and execution details
            before you subscribe or copy.
          </p>
          <form onSubmit={submitSearch} className="mt-5 flex max-w-xl gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search marketplace</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search traders and markets…"
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

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Marketplace shortcuts">
        <Shortcut to={ROUTES.app.marketplace.traders} icon={Users} title="Traders" description="Browse trader profiles" />
        <Shortcut to={ROUTES.app.marketplace.signalProviders} icon={Store} title="Signal providers" description="View live signal publishers" />
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
                {featuredProviders.map((provider, index) => (
                  <MarketplaceTraderCard
                    key={provider.id}
                    provider={provider}
                    winRate={performanceQueries[index]?.data?.metrics?.winRate ?? null}
                    observedExecutions={
                      performanceQueries[index]?.data?.metrics?.observedExecutions ?? 0
                    }
                    isPerformanceLoading={performanceQueries[index]?.isLoading ?? true}
                    isPerformanceError={performanceQueries[index]?.isError ?? false}
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