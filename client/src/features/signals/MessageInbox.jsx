import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { useSignalMessages } from '../../hooks/useSignals.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function MessageInbox() {
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Message Inbox'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Signals', path: ROUTES.app.signals.overview },
        { label: 'Messages', path: ROUTES.app.signals.messages },
      ]),
    );
  }, [dispatch]);

  const messagesQuery = useSignalMessages({ q: query || undefined });
  const messages = messagesQuery.messages ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Message Inbox
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Incoming messages from approved sources. Each message is preserved with its
            provenance and processing state.
          </p>
        </div>
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search messages…"
        className="w-full max-w-xs"
      />

      {messagesQuery.isLoading ? (
        <LoadingState label="Loading messages" />
      ) : messagesQuery.isError ? (
        <ErrorState
          title="Unable to load messages"
          description="We could not fetch messages."
          onRetry={messagesQuery.refetch}
        />
      ) : messages.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={query ? 'No matching messages' : 'Inbox is empty'}
          description={
            query
              ? 'Try a different search query.'
              : 'Messages from approved sources will appear here.'
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {messages.map((message) => (
                <li key={message.id}>
                  <Link
                    to={ROUTES.app.signals.message(message.id)}
                    className="block px-5 py-4 transition hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {message.sourceName ?? 'Unknown source'}
                          </p>
                          <Badge variant={statusVariant(message.status)}>
                            {message.status ?? 'received'}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {message.preview ?? message.content?.slice(0, 200) ?? '—'}
                        </p>
                      </div>
                      <span className="shrink-0 text-2xs text-muted-foreground">
                        {message.receivedAt ? formatRelativeTime(message.receivedAt) : ''}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
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