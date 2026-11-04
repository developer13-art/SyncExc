import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, History, MessageSquare, RefreshCw } from 'lucide-react';

import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { consoleApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { formatDateTime, formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ConsoleActionDialog } from './ConsoleActionDialog.jsx';
import { ConsoleValue } from './ConsoleValue.jsx';
import { humanize, recordLabel, statusVariant } from './console.utils.js';

export function ConsoleDetail({ page, section, recordId }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const resource = page.resource;
  const [actionDialog, setActionDialog] = useState(null);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const detailKey = queryKeys.console.detail(resource?.key, recordId);
  const detailQuery = useQuery({
    queryKey: detailKey,
    queryFn: () => consoleApi.detail(resource.key, recordId),
    enabled: Boolean(resource && recordId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: detailKey });
    queryClient.invalidateQueries({ queryKey: ['admin', 'console', 'list', resource?.key] });
  };

  const noteMutation = useMutation({
    mutationFn: (text) => consoleApi.addNote(resource.key, recordId, text),
    onSuccess: () => {
      toast.success('Internal note added');
      setNote('');
      detailQuery.refetch();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
    onSettled: () => setSavingNote(false),
  });

  if (!resource) {
    return (
      <ErrorState
        title="No data source for this page"
        description="This navigation page is not linked to an allow-listed admin resource."
      />
    );
  }

  if (detailQuery.isLoading) return <LoadingState label="Loading record" />;
  if (detailQuery.isError) {
    return (
      <ErrorState
        title="Could not load record"
        description={getErrorMessage(detailQuery.error)}
        onRetry={() => detailQuery.refetch()}
      />
    );
  }

  const detail = detailQuery.data;
  const record = detail?.record;
  const notes = detail?.notes ?? [];
  const audit = detail?.audit ?? [];
  const recordActions = resource.actions.filter((action) => (action.scope || 'record') === 'record');
  const canManage = page.permissions?.manage;
  const title = recordLabel(record, resource.columns);
  const listPath = `/catalog/${page.sectionId}/${page.pageId}`;

  const submitNote = (event) => {
    event.preventDefault();
    if (note.trim().length < 3) {
      toast.error('Enter a note of at least 3 characters');
      return;
    }
    setSavingNote(true);
    noteMutation.mutate(note.trim());
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={listPath}>
            <ArrowLeft className="h-4 w-4" />
            Back to {humanize(page.pageId)}
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/10">
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {section.label}
                </p>
                <Badge variant="muted" size="sm">{resource.label}</Badge>
              </div>
              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">ID {record?.id}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManage
              ? recordActions.map((action) => (
                <Button
                  key={action.key}
                  variant={action.danger ? 'destructive' : 'outline'}
                  onClick={() => setActionDialog(action)}
                >
                  {action.label}
                </Button>
              ))
              : null}
            <IconButton
              label="Refresh record"
              onClick={() => detailQuery.refetch()}
              disabled={detailQuery.isFetching}
              className="border border-border bg-background/70"
            >
              <RefreshCw className={detailQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </IconButton>
          </div>
        </div>
      </div>

      <Tabs defaultValue="record">
        <TabsList>
          <TabsTrigger value="record">Record</TabsTrigger>
          <TabsTrigger value="notes">
            Notes
            <Badge variant="muted" size="sm" className="ml-2">{notes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="audit">
            Audit
            <Badge variant="muted" size="sm" className="ml-2">{audit.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record">
          <Card>
            <CardHeader>
              <CardTitle>Record fields</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 md:grid-cols-2">
                {resource.columns.map((column) => (
                  <div
                    key={column.key}
                    className={column.kind === 'json' ? 'md:col-span-2' : undefined}
                  >
                    <dt className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                      {column.label}
                    </dt>
                    <dd className="mt-1 text-sm text-foreground">
                      <ConsoleValue column={column} row={record} detailed />
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Internal notes
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form onSubmit={submitNote} className="flex flex-col gap-2">
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add an internal note visible to administrators only…"
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={savingNote}>
                    {savingNote ? 'Saving…' : 'Add note'}
                  </Button>
                </div>
              </form>

              {notes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No internal notes recorded.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {notes.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-border p-3">
                      <p className="whitespace-pre-wrap text-sm text-foreground">{entry.note}</p>
                      <p className="mt-2 text-2xs text-muted-foreground">
                        {entry.author_email || 'Administrator'} · {formatRelativeTime(entry.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Administrative audit trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <p className="text-xs text-muted-foreground">No audit events reference this record.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {audit.map((event) => (
                    <li key={event.id} className="rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs text-foreground">{event.action}</span>
                        <Badge variant={statusVariant(event.outcome)} size="sm">
                          {humanize(event.outcome || 'recorded')}
                        </Badge>
                      </div>
                      {event.reason ? (
                        <p className="mt-1 text-xs text-muted-foreground">{event.reason}</p>
                      ) : null}
                      <p className="mt-1 text-2xs text-muted-foreground">
                        {formatDateTime(event.occurred_at)}
                        {event.actor_id ? ` · ${event.actor_id}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConsoleActionDialog
        open={Boolean(actionDialog)}
        onOpenChange={(open) => {
          if (!open) setActionDialog(null);
        }}
        action={actionDialog}
        resourceKey={resource.key}
        recordId={recordId}
        recordName={title}
        onCompleted={invalidate}
      />
    </div>
  );
}

export default ConsoleDetail;
