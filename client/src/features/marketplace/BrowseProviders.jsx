import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { MultiSelect } from '../../components/forms/MultiSelect.jsx';
import { ProviderCard } from './components/ProviderCard.jsx';
import { useMarketplaceProviders } from '../../hooks/useMarketplace.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const SORT_OPTIONS = [
  { value: 'desc', label: 'Recent' },
];

const MARKET_OPTIONS = [
  { value: 'spot', label: 'Spot' },
  { value: 'futures', label: 'Futures' },
  { value: 'perpetual', label: 'Perpetual' },
];

export default function BrowseProviders() {
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('desc');
  const [markets, setMarkets] = useState([]);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Marketplace'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
      ]),
    );
  }, [dispatch]);

  const providersQuery = useMarketplaceProviders({
    q: query || undefined,
    sort,
    markets: markets.length > 0 ? markets.join(',') : undefined,
  });

  const providers = providersQuery.providers ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Provider Marketplace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Discover signal providers. Following a provider does not authorize copying —
            copying requires a separate configuration.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.marketplace.following}>Following</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.marketplace.subscriptions}>Subscriptions</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search providers…"
          className="w-full max-w-xs"
        />
        <SegmentedControl options={SORT_OPTIONS} value={sort} onChange={setSort} />
        <MultiSelect
          options={MARKET_OPTIONS}
          value={markets}
          onChange={setMarkets}
          placeholder="Markets"
          maxDisplay={2}
          className="w-48"
        />
      </div>

      {providersQuery.isLoading ? (
        <LoadingState label="Loading providers" />
      ) : providersQuery.isError ? (
        <ErrorState
          title="Unable to load providers"
          description="We could not fetch the marketplace."
          onRetry={providersQuery.refetch}
        />
      ) : providers.length === 0 ? (
        <EmptyState
          icon={Store}
          title={query || markets.length > 0 ? 'No matching providers' : 'No providers yet'}
          description={
            query || markets.length > 0
              ? 'Try adjusting your search or filters.'
              : 'Providers will appear here as the marketplace grows.'
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      )}
    </div>
  );
}