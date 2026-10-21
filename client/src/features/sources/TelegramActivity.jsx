import { useQuery } from '@tanstack/react-query';

import { Alert } from '../../components/ui/Alert.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { signalsApi, sourcesApi } from '../../api/index.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

export function TelegramActivity({ sourceId, monitoringEnabled }) {
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
  const historyQuery = useQuery({
    queryKey: ['telegram-source-history', sourceId],
    queryFn: () => sourcesApi.listTelegramMessages(sourceId, { limit: 8 }),
    enabled: Boolean(sourceId),
    refetchInterval: 30_000,
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
  const history = historyQuery.data ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>Recent Telegram messages</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {historyQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading recent channel messages…</p>
          ) : historyQuery.isError ? (
            <Alert variant="warning" title="Telegram messages unavailable">
              <p className="text-xs">Reconnect the Telegram source and try again.</p>
            </Alert>
          ) : history.length ? history.map((message) => (
            <article key={message.id} className="rounded-lg border border-border p-3">
              <p className="mb-2 text-xs text-muted-foreground">{formatDateTime(message.timestamp)}</p>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                {message.content || 'Media message (media is not downloaded)'}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Telegram message {message.id}</p>
            </article>
          )) : (
            <p className="text-sm text-muted-foreground">No messages are available in this chat.</p>
          )}
          <p className="text-xs text-muted-foreground">
            This is a read-only preview. Older messages are not imported for signal processing or
            trading.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Messages processed</CardTitle></CardHeader>
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
          {!messages.length && monitoringEnabled ? (
            <p className="text-xs text-muted-foreground">
              Telegram history is not replayed when a source is connected, to prevent old signals
              from being treated as new trades. Only messages posted after monitoring starts are
              processed.
            </p>
          ) : null}
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
