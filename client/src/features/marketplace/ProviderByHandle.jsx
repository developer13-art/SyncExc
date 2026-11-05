import { Link, Navigate, useParams } from 'react-router-dom';

import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { useMarketplaceProviders } from '../../hooks/useMarketplace.js';
import { ROUTES } from '../../config/routes.config.js';

const HANDLE_ALIASES = {
  'syncexc-official-ai-trader': 'syncexc-official',
};

export default function ProviderByHandle() {
  const { handle } = useParams();
  const lookupHandle = HANDLE_ALIASES[handle] ?? handle;
  const providersQuery = useMarketplaceProviders({ q: lookupHandle, limit: 20 });

  if (providersQuery.isLoading) {
    return <LoadingState label="Loading trader" />;
  }

  if (providersQuery.error) {
    return <ErrorState title="Unable to load trader" onRetry={providersQuery.refetch} />;
  }

  const provider = providersQuery.providers.find((entry) => entry.handle === lookupHandle);

  if (!provider) {
    return (
      <ErrorState
        title="Trader not found"
        description="This trader profile is no longer available. Browse traders to find a current profile."
        action={(
          <Button asChild>
            <Link to={ROUTES.app.marketplace.traders}>Browse traders</Link>
          </Button>
        )}
      />
    );
  }

  return <Navigate to={ROUTES.app.marketplace.provider(provider.id)} replace />;
}
