import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { JsonViewer } from '../../components/ui/JsonViewer.jsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { signalsApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

export default function MessageDetails() {
  const { messageId } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const messageQuery = useQuery({
    queryKey: queryKeys.signals.message(messageId),
    queryFn: () => signalsApi.getMessage(messageId),
    enabled: Boolean(messageId),
  });

  if (messageQuery.isLoading) {
    return <LoadingState label="Loading message" />;
  }

  if (messageQuery.error || !messageQuery.data) {
    return (
      <ErrorState
        title="Unable to load message"
        description="This message could not be retrieved."
        onRetry={messageQuery.refetch}
      />
    );
  }

  const message = messageQuery.data;

  const handleReprocess = async () => {
    try {
      await signalsApi.reprocessMessage(messageId, {});
      toast.success('Reprocessing requested');
      queryClient.invalidateQueries({ queryKey: queryKeys.signals.message(messageId) });
    } catch (err) {
      toast.error('Reprocess failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.signals.messages}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {message.sourceName ?? 'Message'}
            </h1>
            <Badge variant={statusVariant(message.status)}>
              {message.status ?? 'received'}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">{message.id}</p>
        </div>
        <Button variant="outline" onClick={handleReprocess}>
          <RefreshCw className="h-4 w-4" /> Reprocess
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Source" value={message.sourceName ?? '—'} />
          <Field label="Platform" value={message.platform ?? '—'} />
          <Field
            label="Provider message ID"
            value={message.providerMessageId ?? '—'}
          />
          <Field
            label="Received"
            value={message.receivedAt ? formatDateTime(message.receivedAt) : '—'}
          />
          <Field
            label="Provider time"
            value={message.providerTimestamp ? formatDateTime(message.providerTimestamp) : '—'}
          />
          <Field label="Content type" value={message.contentType ?? 'text'} />
          <Field label="Language" value={message.language ?? '—'} />
          <Field label="Ingestion status" value={message.ingestionStatus ?? '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Original content</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-3 font-mono text-xs text-foreground scrollbar-thin">
            {message.content ?? '(empty)'}
          </pre>
        </CardContent>
      </Card>

      {message.structured ? (
        <Card>
          <CardHeader>
            <CardTitle>Structured output</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonViewer data={message.structured} />
          </CardContent>
        </Card>
      ) : null}

      {message.processingTimeline?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Processing timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {message.processingTimeline.map((event, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {event.title ?? event.type}
                    </p>
                    {event.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {event.occurredAt ? formatDateTime(event.occurredAt) : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function statusVariant(status) {
  if (status === 'processed') {
    return 'success';
  }
  if (status === 'failed') {
    return 'destructive';
  }
  if (status === 'processing') {
    return 'warning';
  }
  return 'muted';
}