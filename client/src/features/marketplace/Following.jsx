import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';

import { marketplaceApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ROUTES } from '../../config/routes.config.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { MarketplaceNavigation } from './components/MarketplaceNavigation.jsx';

export default function Following() {
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();
  const followsQuery = useQuery({
    queryKey: queryKeys.marketplace.follows({}),
    queryFn: () => marketplaceApi.listFollows({}),
  });
  const strategyFollowsQuery = useQuery({
    queryKey: queryKeys.marketplace.followedStrategies,
    queryFn: () => marketplaceApi.listFollowedStrategies(),
  });
  const unfollowMutation = useMutation({
    mutationFn: ({ type, id }) => type === 'strategy'
      ? marketplaceApi.unfollowStrategy(id)
      : marketplaceApi.unfollowProvider(id),
    onSuccess: async (_result, { type }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.follows({}) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.followedStrategies }),
        queryClient.invalidateQueries({ queryKey: ['marketplace', 'strategies'] }),
      ]);
      toast.success(type === 'strategy' ? 'Strategy removed from watchlist' : 'Trader removed from watchlist');
    },
    onError: (error) => toast.error('Could not update watchlist', { description: getErrorMessage(error) }),
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Watchlist'));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
      { label: 'Watchlist', path: ROUTES.app.marketplace.watchlist },
    ]));
  }, [dispatch]);

  const entries = useMemo(() => {
    const providers = (followsQuery.data?.items ?? []).map((follow) => {
      const provider = follow.provider ?? follow;
      return {
        id: provider.id ?? follow.providerId ?? follow.provider_id,
        type: 'trader',
        name: provider.displayName ?? provider.display_name ?? provider.handle ?? 'Trader',
        handle: provider.handle,
        avatarUrl: provider.avatarUrl ?? provider.avatar_url,
        providerId: provider.id ?? follow.providerId ?? follow.provider_id,
        markets: provider.supportedMarkets ?? provider.supported_markets ?? [],
        count: provider.followerCount ?? provider.follower_count,
        followedAt: follow.followedAt ?? follow.createdAt ?? follow.created_at,
      };
    });
    const strategies = (strategyFollowsQuery.data ?? []).map((strategy) => ({
      id: strategy.id,
      type: 'strategy',
      name: strategy.name,
      handle: strategy.providerName,
      avatarUrl: strategy.providerAvatarUrl,
      strategyId: strategy.id,
      markets: strategy.supportedMarkets ?? [],
      count: strategy.followerCount,
      followedAt: strategy.followedAt,
    }));
    return [...providers, ...strategies].sort(
      (a, b) => new Date(b.followedAt || 0) - new Date(a.followedAt || 0),
    );
  }, [followsQuery.data, strategyFollowsQuery.data]);

  const isLoading = followsQuery.isLoading || strategyFollowsQuery.isLoading;
  const error = followsQuery.error || strategyFollowsQuery.error;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <MarketplaceNavigation active="watchlist" />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Watchlist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep the traders and strategies you follow in one place.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={ROUTES.app.marketplace.browse}>Discover marketplace</Link>
        </Button>
      </header>

      {isLoading ? (
        <LoadingState label="Loading your watchlist" />
      ) : error ? (
        <ErrorState
          title="Watchlist unavailable"
          description={getErrorMessage(error)}
          onRetry={() => {
            followsQuery.refetch();
            strategyFollowsQuery.refetch();
          }}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Your watchlist is empty"
          description="Follow a trader or strategy from the Marketplace to save it here."
          action={<Button asChild><Link to={ROUTES.app.marketplace.browse}>Explore marketplace</Link></Button>}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Markets</th>
                    <th className="px-4 py-3 font-medium">Followers</th>
                    <th className="px-4 py-3 font-medium">Added</th>
                    <th className="px-5 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry) => {
                    const target = entry.type === 'strategy'
                      ? ROUTES.app.marketplace.strategy(entry.strategyId)
                      : ROUTES.app.marketplace.provider(entry.providerId);
                    return (
                      <tr key={`${entry.type}-${entry.id}`} className="hover:bg-muted/20">
                        <td className="px-5 py-3">
                          <Link to={target} className="flex min-w-0 items-center gap-3">
                            <Avatar src={entry.avatarUrl} fallback={entry.name.slice(0, 1)} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-foreground">{entry.name}</span>
                              {entry.handle ? <span className="block truncate text-xs text-muted-foreground">{entry.type === 'trader' ? `@${entry.handle}` : `by ${entry.handle}`}</span> : null}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="muted">{entry.type === 'strategy' ? 'Strategy' : 'Trader'}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {entry.markets.slice(0, 3).map((market) => <Badge key={market} variant="outline">{market}</Badge>)}
                            {entry.markets.length === 0 ? <span className="text-muted-foreground">—</span> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {entry.count == null ? '—' : Number(entry.count).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {entry.followedAt ? formatRelativeTime(entry.followedAt) : '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={unfollowMutation.isPending}
                            onClick={() => unfollowMutation.mutate({
                              type: entry.type,
                              id: entry.type === 'strategy' ? entry.strategyId : entry.providerId,
                            })}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
