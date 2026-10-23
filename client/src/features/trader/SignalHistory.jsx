import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';

import { marketplaceApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ROUTES } from '../../config/routes.config.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

export default function SignalHistory() {
  const { activeWorkspaceId } = useWorkspaceContext();
  const signalsQuery = useQuery({
    queryKey: ['marketplace', 'my-signals', activeWorkspaceId],
    queryFn: () => marketplaceApi.listMySignals({ limit: 100 }),
    refetchInterval: 5000,
  });
  const signals = signalsQuery.data?.items ?? [];

  if (signalsQuery.isLoading) return <LoadingState label="Loading published signals" />;
  if (signalsQuery.isError) {
    return (
      <ErrorState
        title="Signal history unavailable"
        description={getErrorMessage(signalsQuery.error)}
        onRetry={signalsQuery.refetch}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Signal history</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signals published from this Trader workspace.</p>
        </div>
        <Button asChild><Link to={ROUTES.app.trader.publishSignal}>Publish signal</Link></Button>
      </header>

      <Card>
        <CardHeader><CardTitle>Published signals</CardTitle></CardHeader>
        <CardContent>
          {signals.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No signals published yet"
              description="New signals will appear here after they are published."
              action={<Button asChild><Link to={ROUTES.app.trader.publishSignal}>Create a signal</Link></Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Instrument</th>
                    <th className="px-3 py-3 font-medium">Market</th>
                    <th className="px-3 py-3 font-medium">Direction</th>
                    <th className="px-3 py-3 font-medium">Entry</th>
                    <th className="px-3 py-3 font-medium">Trader account execution</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {signals.map((signal) => (
                    <tr key={signal.id}>
                      <td className="px-3 py-4 text-muted-foreground">
                        {signal.createdAt ? formatRelativeTime(signal.createdAt) : '—'}
                      </td>
                      <td className="px-3 py-4 font-medium text-foreground">{signal.instrument}</td>
                      <td className="px-3 py-4 capitalize">{signal.marketType}</td>
                      <td className="px-3 py-4 capitalize">{signal.direction}</td>
                      <td className="px-3 py-4">
                        {signal.entry ?? (signal.entryRange
                          ? `${signal.entryRange.min} – ${signal.entryRange.max}`
                          : '—')}
                      </td>
                      <td className="px-3 py-4">
                        {signal.traderExecutions?.length ? (
                          <ul className="space-y-1">
                            {signal.traderExecutions.map((execution, index) => (
                              <li key={`${execution.status}-${index}`}>
                                {execution.exchangeCode ? (
                                  <span className="mr-2 text-xs capitalize text-muted-foreground">
                                    {execution.exchangeCode}
                                    {execution.accountType ? ` ${execution.accountType}` : ''}:
                                  </span>
                                ) : null}
                                <Badge
                                  variant={['submitted', 'filled', 'partially_filled'].includes(execution.status)
                                    ? 'success'
                                    : execution.status === 'awaiting_confirmation'
                                      ? 'warning'
                                      : 'muted'}
                                >
                                  {execution.status?.replaceAll('_', ' ') ?? 'unknown'}
                                </Badge>
                                {execution.errorMessage ? (
                                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                                    {execution.errorMessage}
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground">
                            No attempt recorded; check{' '}
                            <Link className="text-primary underline" to={ROUTES.app.settings.trading}>
                              execution settings
                            </Link>{' '}
                            and active accounts.
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <Badge variant={['published', 'updated'].includes(signal.status) ? 'success' : 'muted'}>
                          {signal.status?.replaceAll('_', ' ') ?? 'unknown'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
