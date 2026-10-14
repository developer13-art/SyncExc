import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { UserCheck } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { ProviderCard } from './components/ProviderCard.jsx';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Following() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Following'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
        { label: 'Following', path: ROUTES.app.marketplace.following },
      ]),
    );
  }, [dispatch]);

  const followsQuery = useQuery({
    queryKey: queryKeys.marketplace.follows({}),
    queryFn: () => marketplaceApi.listFollows({}),
  });

  const follows = followsQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Following
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Providers you follow. Following saves a provider and shows you its public
            content — it does not enable copying.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={ROUTES.app.marketplace.browse}>Browse providers</Link>
        </Button>
      </div>

      {followsQuery.isLoading ? (
        <LoadingState label="Loading followed providers" />
      ) : followsQuery.isError ? (
        <ErrorState
          title="Unable to load followed providers"
          description="We could not fetch your follows."
          onRetry={followsQuery.refetch}
        />
      ) : follows.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="Not following anyone yet"
          description="Browse the marketplace to find providers whose published content you want to follow."
          action={
            <Button asChild>
              <Link to={ROUTES.app.marketplace.browse}>Browse providers</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {follows.map((follow) => (
            <ProviderCard key={follow.id} provider={follow.provider ?? follow} />
          ))}
        </div>
      )}
    </div>
  );
}