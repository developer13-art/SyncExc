import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, PauseCircle, PlayCircle, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { SourceStatusBadge } from '../../components/domain/source/SourceStatusBadge.jsx';
import { SourceHealthBadge } from '../../components/domain/source/SourceHealthBadge.jsx';
import { SourceConnection } from './SourceConnection.jsx';
import { SourceValidation } from './SourceValidation.jsx';
import { SourceHealth } from './SourceHealth.jsx';
import { SourceQuality } from './SourceQuality.jsx';
import { SourceSandbox } from './SourceSandbox.jsx';
import { SourceAudit } from './SourceAudit.jsx';
import { useSource, useSources } from '../../hooks/useSources.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function SourceDetails() {
  const { sourceId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();

  const sourceQuery = useSource(sourceId);
  const { enableSource, pauseSource, revalidate } = useSources();

  const { source, health, quality, connection, isLoading, error } = sourceQuery;

  useEffect(() => {
    if (source) {
      dispatch(uiActions.setPageTitle(source.name));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Sources', path: ROUTES.app.sources.overview },
          { label: source.name, path: ROUTES.app.sources.details(source.id) },
        ]),
      );
    }
  }, [source, dispatch]);

  if (isLoading) {
    return <LoadingState label="Loading source" />;
  }

  if (error || !source) {
    return (
      <ErrorState
        title="Unable to load source"
        description="This source could not be retrieved."
        onRetry={sourceQuery.refetch}
      />
    );
  }

  const isActive = source.status === 'active';
  const isPaused = source.status === 'paused';

  const handleEnable = async () => {
    try {
      await enableSource(source.id);
      toast.success('Source enabled');
    } catch (err) {
      toast.error('Enable failed', { description: getErrorMessage(err) });
    }
  };

  const handlePause = async () => {
    try {
      await pauseSource({ sourceId: source.id, reason: 'User-requested pause' });
      toast.success('Source paused');
    } catch (err) {
      toast.error('Pause failed', { description: getErrorMessage(err) });
    }
  };

  const handleRevalidate = async () => {
    try {
      await revalidate({ sourceId: source.id });
      toast.success('Revalidation started');
    } catch (err) {
      toast.error('Revalidation failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.sources.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {source.name}
            </h1>
            <SourceStatusBadge status={source.status} />
            <SourceHealthBadge status={health?.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {source.platform}
            {source.category ? ` · ${source.category}` : ''}
            {source.lastEventAt
              ? ` · Last event ${formatDateTime(source.lastEventAt)}`
              : ''}
          </p>
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> {source.url}
            </a>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <IconButton
            label="Revalidate"
            onClick={handleRevalidate}
            className="border border-border"
          >
            <RefreshCw className="h-4 w-4" />
          </IconButton>
          {!isActive ? (
            <Button onClick={handleEnable}>
              <PlayCircle className="h-4 w-4" /> Enable
            </Button>
          ) : isPaused ? (
            <Button onClick={handleEnable}>
              <PlayCircle className="h-4 w-4" /> Resume
            </Button>
          ) : (
            <Button variant="outline" onClick={handlePause}>
              <PauseCircle className="h-4 w-4" /> Pause
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Message count
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {source.messageCount?.toLocaleString() ?? '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Parsing success
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {quality?.parsingSuccess !== undefined
                ? `${quality.parsingSuccess.toFixed(0)}%`
                : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Last validation
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {source.lastValidatedAt ? formatDateTime(source.lastValidatedAt) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Ownership
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {source.workspaceName ?? 'Personal'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="connection">
        <TabsList>
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="connection">
          <SourceConnection sourceId={sourceId} />
        </TabsContent>
        <TabsContent value="validation">
          <SourceValidation sourceId={sourceId} />
        </TabsContent>
        <TabsContent value="health">
          <SourceHealth sourceId={sourceId} />
        </TabsContent>
        <TabsContent value="quality">
          <SourceQuality sourceId={sourceId} />
        </TabsContent>
        <TabsContent value="sandbox">
          <SourceSandbox sourceId={sourceId} />
        </TabsContent>
        <TabsContent value="audit">
          <SourceAudit sourceId={sourceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}