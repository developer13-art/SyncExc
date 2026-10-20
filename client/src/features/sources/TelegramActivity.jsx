import { useQuery } from '@tanstack/react-query';

import { Alert } from '../../components/ui/Alert.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { signalsApi } from '../../api/index.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

export function TelegramActivity({ sourceId }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['telegram-source-activity', sourceId],
    queryFn: async () => {
      const [messages, candidates] = await Promise.all([
        signalsApi.listMessages({ sourceId, limit: 8 }),
        signalsApi.listSignals({ sourceId, limit: 8 }),
      ]);
      return { messages: messages.items ?? [], candidates: candidates.items ?? [] };
    },
    enabled: Boolean(sourceId),
    refetchInterval: 15_000,
  });

  if (isLoading) return <LoadingState label="Loading Telegram activity" />;
  if (error) {
    return (
      <Alert variant="warning" title="Telegram activity unavailable">
        <p className="text-xs">Could not load the latest messages and detected signals.</p>
      </Alert>
    );
  }

  const messages = data?.messages ?? [];
  const candidates = data?.candidates ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Latest messages processed</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {messages.length ? messages.map((message) => (
            <article key={message.id} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{formatDateTime(message.providerTimestamp || message.receivedAt)}</span>
                <span className="capitalize">{String(message.processingStatus || 'received').replaceAll('_', ' ')}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                {message.content || 'No text content'}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Telegram message {message.providerMessageId || message.id}
              </p>
            </article>
          )) : (
            <p className="text-sm text-muted-foreground">
              No Telegram messages have been processed yet. New messages appear here automatically.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Detected signals and execution status</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {candidates.length ? candidates.map((candidate) => (
            <article key={candidate.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">
                  {candidate.instrument || 'Unresolved instrument'} · {candidate.direction || 'Unresolved direction'}
                </p>
                <span className="text-xs capitalize text-muted-foreground">
                  {String(candidate.status || 'processing').replaceAll('_', ' ')}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Execution: {String(candidate.executionStatus || 'not submitted').replaceAll('_', ' ')}
                {' · '}{formatDateTime(candidate.createdAt)}
              </p>
            </article>
          )) : (
            <p className="text-sm text-muted-foreground">
              No trading signals have been detected from this source yet. Messages that are unrelated or unsafe remain out of execution.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default TelegramActivity;
