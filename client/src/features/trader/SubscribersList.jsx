import { useQuery } from '@tanstack/react-query';
import { UsersRound } from 'lucide-react';

import { marketplaceApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

export default function SubscribersList() {
  const { activeWorkspaceId } = useWorkspaceContext();
  const subscribersQuery = useQuery({
    queryKey: ['marketplace', 'my-subscribers', activeWorkspaceId],
    queryFn: () => marketplaceApi.getMySubscribers({ limit: 100 }),
  });
  const subscribers = subscribersQuery.data?.items ?? [];

  if (subscribersQuery.isLoading) return <LoadingState label="Loading subscribers" />;
  if (subscribersQuery.isError) {
    return (
      <ErrorState
        title="Subscribers unavailable"
        description={getErrorMessage(subscribersQuery.error)}
        onRetry={subscribersQuery.refetch}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Subscribers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Active users subscribed to this Trader profile. Contact details are not exposed here.
        </p>
      </header>
      <Card>
        <CardHeader><CardTitle>{subscribers.length} active subscribers</CardTitle></CardHeader>
        <CardContent>
          {subscribers.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No active subscribers yet"
              description="Subscribers will appear here when users subscribe to your active plan."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {subscribers.map((subscriber) => (
                <Card key={subscriber.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{subscriber.displayName}</p>
                        <p className="truncate text-sm text-muted-foreground">@{subscriber.username}</p>
                      </div>
                      <Badge variant="success">{subscriber.status}</Badge>
                    </div>
                    <dl className="mt-4 grid gap-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Plan</dt>
                        <dd className="font-medium text-foreground">{subscriber.planName}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Subscribed</dt>
                        <dd className="text-foreground">
                          {subscriber.createdAt ? formatRelativeTime(subscriber.createdAt) : '—'}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
