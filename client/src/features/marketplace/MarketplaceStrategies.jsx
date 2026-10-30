import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Search, Workflow } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { marketplaceApi } from '../../api/index.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ROUTES } from '../../config/routes.config.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { MarketplaceNavigation } from './components/MarketplaceNavigation.jsx';
import { MarketplaceStrategyCard } from './components/MarketplaceStrategyCard.jsx';

const MARKETS = ['all', 'spot', 'futures', 'perpetual'];

export default function MarketplaceStrategies() {
  const dispatch = useDispatch();
  const [search, setSearch] = useState('');
  const [market, setMarket] = useState('all');
  const params = {
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(market !== 'all' ? { market } : {}),
    limit: 50,
  };
  const strategiesQuery = useQuery({
    queryKey: ['marketplace', 'strategies', params],
    queryFn: () => marketplaceApi.listStrategies(params),
    staleTime: 30_000,
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Marketplace strategies'));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
      { label: 'Strategies', path: ROUTES.app.marketplace.strategies },
    ]));
  }, [dispatch]);

  const strategies = Array.isArray(strategiesQuery.data) ? strategiesQuery.data : [];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <MarketplaceNavigation active="strategies" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Explore systematic trading</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Marketplace strategies
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Discover strategies published from validated trader workflows. Review the markets,
            provider, and subscription terms before you follow or deploy.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search strategies</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search strategies, markets, or traders…"
            className="pl-9"
          />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Filter by market">
          {MARKETS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={market === option}
              onClick={() => setMarket(option)}
              className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                market === option
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {option === 'all' ? 'All markets' : option}
            </button>
          ))}
        </div>
      </div>

      {strategiesQuery.isLoading ? (
        <LoadingState label="Loading marketplace strategies" />
      ) : strategiesQuery.isError ? (
        <ErrorState
          title="Strategies could not be loaded"
          description="The marketplace strategy catalog is temporarily unavailable."
          onRetry={strategiesQuery.refetch}
        />
      ) : strategies.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title={search || market !== 'all' ? 'No matching strategies' : 'No strategies published yet'}
          description={
            search || market !== 'all'
              ? 'Try another search or market filter.'
              : 'Published strategies will appear here after a trader lists a validated workflow.'
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {strategies.length} {strategies.length === 1 ? 'strategy' : 'strategies'}
            </p>
            <Badge variant="muted">Recently published</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {strategies.map((strategy) => (
              <MarketplaceStrategyCard key={strategy.id} strategy={strategy} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
