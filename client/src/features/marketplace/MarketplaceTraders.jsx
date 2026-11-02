import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { Store } from 'lucide-react';

import { marketplaceApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { MultiSelect } from '../../components/forms/MultiSelect.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';
import { useMarketplaceProviders } from '../../hooks/useMarketplace.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { MarketplaceNavigation } from './components/MarketplaceNavigation.jsx';
import { MarketplaceTraderCard } from './components/MarketplaceTraderCard.jsx';

const SORT_OPTIONS = [
  { value: 'performance', label: 'Top performers' },
  { value: 'followers', label: 'Most followers' },
  { value: 'new', label: 'New' },
];

const MARKET_OPTIONS = [
  { value: 'spot', label: 'Spot' },
  { value: 'futures', label: 'Futures' },
  { value: 'perpetual', label: 'Perpetual' },
];

export default function MarketplaceTraders() {
  const dispatch = useDispatch();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isSignalDirectory = location.pathname === ROUTES.app.marketplace.signalProviders;
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [sort, setSort] = useState('performance');
  const [markets, setMarkets] = useState([]);
  const {
    providers,
    isLoading,
    error,
    refetch,
  } = useMarketplaceProviders({
    limit: 12,
    q: query.trim() || undefined,
    markets: markets.length ? markets.join(',') : undefined,
  });
  const performanceQueries = useQueries({
    queries: providers.map((provider) => ({
      queryKey: queryKeys.marketplace.providerPerformance(provider.id, {}),
      queryFn: () => marketplaceApi.getProviderPerformance(provider.id),
      enabled: Boolean(provider.id),
      staleTime: 60_000,
      retry: false,
    })),
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle(isSignalDirectory ? 'Signal providers' : 'Traders'));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
      {
        label: isSignalDirectory ? 'Signal providers' : 'Traders',
        path: isSignalDirectory
          ? ROUTES.app.marketplace.signalProviders
          : ROUTES.app.marketplace.traders,
      },
    ]));
  }, [dispatch, isSignalDirectory]);

  const providersWithMetrics = useMemo(() => providers.map((provider, index) => ({
    ...provider,
    winRate: performanceQueries[index]?.data?.metrics?.winRate ?? null,
    observedExecutions: performanceQueries[index]?.data?.metrics?.observedExecutions ?? 0,
    isPerformanceLoading: performanceQueries[index]?.isLoading ?? true,
    isPerformanceError: performanceQueries[index]?.isError ?? false,
  })), [providers, performanceQueries]);
  const sortedProviders = useMemo(() => {
    const sorted = [...providersWithMetrics];
    if (sort === 'followers') {
      sorted.sort((a, b) => Number(b.followerCount || 0) - Number(a.followerCount || 0));
    } else if (sort === 'performance') {
      sorted.sort((a, b) =>
        Number(b.winRate ?? -1) - Number(a.winRate ?? -1) ||
        Number(b.observedExecutions || 0) - Number(a.observedExecutions || 0),
      );
    } else {
      sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    return sorted;
  }, [providersWithMetrics, sort]);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <MarketplaceNavigation active={isSignalDirectory ? 'signals' : 'traders'} />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {isSignalDirectory ? 'Signal providers' : 'Traders'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSignalDirectory
            ? 'Find providers publishing live signals and review their independently reported history.'
            : 'Find traders and compare exact closed-trade performance.'}
        </p>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search traders…"
            className="w-full sm:max-w-sm"
          />
          <MultiSelect
            options={MARKET_OPTIONS}
            value={markets}
            onChange={setMarkets}
            placeholder="All markets"
            maxDisplay={2}
            className="w-full sm:w-48"
          />
        </div>
        <SegmentedControl options={SORT_OPTIONS} value={sort} onChange={setSort} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Loading profiles…' : `${providers.length} ${providers.length === 1 ? 'profile' : 'profiles'}`}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={refetch}>
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <LoadingState label="Loading trader profiles" />
      ) : error ? (
        <ErrorState
          title="Trader directory unavailable"
          description={getErrorMessage(error)}
          onRetry={refetch}
        />
      ) : sortedProviders.length === 0 ? (
        <EmptyState
          icon={Store}
          title={query || markets.length ? 'No matching traders' : 'No public profiles yet'}
          description={
            query || markets.length
              ? 'Try changing your search or market filters.'
              : 'Approved public trader profiles will appear here.'
          }
          action={
            !query && !markets.length ? (
              <Button asChild>
                <Link to={ROUTES.app.marketplace.browse}>Explore marketplace</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedProviders.map((provider) => (
            <MarketplaceTraderCard
              key={provider.id}
              provider={provider}
              winRate={provider.winRate}
              observedExecutions={provider.observedExecutions}
              isPerformanceLoading={provider.isPerformanceLoading}
              isPerformanceError={provider.isPerformanceError}
            />
          ))}
        </div>
      )}
      {!isLoading && !error ? (
        <p className="text-xs text-muted-foreground">
          Win rates use linked closed trades only. Profiles with insufficient observations show
          “—”; past results do not guarantee future performance.
        </p>
      ) : null}
    </div>
  );
}
