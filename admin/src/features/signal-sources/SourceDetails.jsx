import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Timeline } from '../../components/ui/Timeline.jsx';
import { SourceActionPanel } from './SourceActionPanel.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { signalSourcesApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime, formatRelativeTime } from '../../lib/formatters/date.formatter.js';

const STATUS_VARIANTS = {
  active: 'success',
  pending_review: 'warning',
  paused: 'muted',
  suspended: 'destructive',
  needs_attention: 'warning',
  archived: 'muted',
};

export default function SourceDetails() {
  const { sourceId } = useParams();
  const dispatch = useDispatch();

  const sourceQuery = useQuery({
    queryKey: ['signal-source', sourceId],
    queryFn: () => signalSourcesApi.get(sourceId),
    enabled: Boolean(sourceId),
  });

  const healthQuery = useQuery({
    queryKey: ['signal-source', sourceId, 'health'],
    queryFn: () => signalSourcesApi.health(sourceId),
    enabled: Boolean(sourceId),
    refetchInterval: 60_000,
  });

  const qualityQuery = useQuery({
    queryKey: ['signal-source', sourceId, 'quality'],
    queryFn: () => signalSourcesApi.quality(sourceId),
    enabled: Boolean(sourceId),
  });

  const auditQuery = useQuery({
    queryKey: ['signal-source', sourceId, 'audit'],
    queryFn: () => signalSourcesApi.audit(sourceId, { pageSize: 20 }),
    enabled: Boolean(sourceId),
  });

  useEffect(() => {
    if (sourceQuery.data) {
      dispatch(adminUiActions.setPageTitle(sourceQuery.data.name ?? 'Signal Source'));
      dispatch(
        adminUiActions.setBreadcrumbs([
          { label: 'Signal Sources', path: '/signal-sources' },
          { label: sourceQuery.data.name ?? 'Source', path: `/signal-sources/${sourceId}` },
        ]),
      );
    }
  }, [sourceQuery.data, dispatch, sourceId]);

  if (sourceQuery.isLoading) {
    return <LoadingState label="Loading source" />;
  }

  if (sourceQuery.error || !sourceQuery.data) {
    return (
      <ErrorState
        title="Unable to load source"
        description="This signal source could not be retrieved."
        onRetry={sourceQuery.refetch}
      />
    );
  }

  const source = sourceQuery.data;
  const health = healthQuery.data;
  const quality = qualityQuery.data;
  const audit = auditQuery.data?.items ?? [];

  const timelineEvents = audit.map((event) => ({
    id: event.id,
    title: event.action?.replace(/_/g, ' ') ?? 'event',
    description: event.reason,
    timestamp: event.occurredAt ? formatDateTime(event.occurredAt) : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/signal-sources">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {source.name}
            </h1>
            <Badge variant={STATUS_VARIANTS[source.status] ?? 'muted'}>
              {source.status?.replace(/_/g, '/') ?? 'unknown'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {source.platform}
            {source.ownerWorkspaceName ? ` · ${source.ownerWorkspaceName}` : ''}
            {source.lastEventAt ? ` · Last event ${formatRelativeTime(source.lastEventAt)}` : ''}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Platform" value={source.platform ?? '—'} />
          <Field label="Category" value={source.category ?? '—'} />
          <Field label="Language" value={source.language ?? '—'} />
          <Field label="Owner" value={source.ownerWorkspaceName ?? '—'} />
          <Field
            label="Connection method"
            value={source.connectionMethod ?? '—'}
          />
          <Field
            label="Parsing success rate"
            value={
              quality?.parsingSuccessRate !== undefined
                ? `${(quality.parsingSuccessRate * 100).toFixed(1)}%`
                : '—'
            }
          />
          <Field
            label="Messages 24h"
            value={source.messageCount24h ?? 0}
          />
          <Field
            label="Health"
            value={health?.status ?? '—'}
          />
        </CardContent>
      </Card>

      <SourceActionPanel sourceId={sourceId} source={source} />

      {timelineEvents.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent lifecycle events</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline items={timelineEvents} />
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