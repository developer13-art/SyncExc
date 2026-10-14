import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, PauseCircle, PlayCircle, RefreshCw, Settings2 } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { OperationStatusBadge } from '../../components/domain/sync/OperationStatusBadge.jsx';
import { Destinations } from './Destinations.jsx';
import { Operations } from './Operations.jsx';
import { Reconciliation } from './Reconciliation.jsx';
import { useSyncGroup } from '../../hooks/useSync.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatPercent } from '../../lib/formatters/percent.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function SyncGroupDetails() {
  const { groupId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();

  const groupQuery = useSyncGroup(groupId);
  const { group, health, isLoading, error, pauseGroup, resumeGroup, activateGroup } = groupQuery;

  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    if (group) {
      dispatch(uiActions.setPageTitle(group.name));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Synchronization', path: ROUTES.app.synchronization.overview },
          { label: group.name, path: ROUTES.app.synchronization.group(group.id) },
        ]),
      );
    }
  }, [group, dispatch]);

  if (isLoading) {
    return <LoadingState label="Loading sync group" />;
  }

  if (error || !group) {
    return (
      <ErrorState
        title="Unable to load sync group"
        description="This synchronization group could not be retrieved."
        onRetry={groupQuery.refetch}
      />
    );
  }

  const isActive = group.status === 'active';
  const isPaused = group.status === 'paused';

  const handlePause = async () => {
    setActionPending(true);
    try {
      await pauseGroup({ groupId, reason: 'Manual pause from UI' });
      toast.success('Sync group paused', {
        description: 'New eligible dispatches are stopped. Existing orders are still tracked.',
      });
      setPauseDialogOpen(false);
    } catch (err) {
      toast.error('Pause failed', { description: getErrorMessage(err) });
    } finally {
      setActionPending(false);
    }
  };

  const handleResume = async () => {
    setActionPending(true);
    try {
      await resumeGroup(groupId);
      toast.success('Sync group resumed');
    } catch (err) {
      toast.error('Resume failed', { description: getErrorMessage(err) });
    } finally {
      setActionPending(false);
    }
  };

  const handleActivate = async () => {
    setActionPending(true);
    try {
      await activateGroup(groupId);
      toast.success('Sync group activated');
    } catch (err) {
      toast.error('Activation failed', { description: getErrorMessage(err) });
    } finally {
      setActionPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.synchronization.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {group.name}
            </h1>
            <Badge variant={isActive ? 'success' : isPaused ? 'warning' : 'muted'}>
              {group.status ?? 'inactive'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {group.source?.exchangeName ?? 'Source'} → {group.destinationCount ?? 0} destination
            {(group.destinationCount ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <IconButton
            label="Refresh"
            onClick={() => groupQuery.refetch?.()}
            className="border border-border"
          >
            <RefreshCw className="h-4 w-4" />
          </IconButton>
          {!isActive && !isPaused ? (
            <Button onClick={handleActivate} disabled={actionPending}>
              <PlayCircle className="h-4 w-4" />
              Activate
            </Button>
          ) : isActive ? (
            <Button
              variant="outline"
              onClick={() => setPauseDialogOpen(true)}
              disabled={actionPending}
            >
              <PauseCircle className="h-4 w-4" />
              Pause
            </Button>
          ) : (
            <Button onClick={handleResume} disabled={actionPending}>
              <PlayCircle className="h-4 w-4" />
              Resume
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">Operations</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {group.operationCount ?? 0}
            </p>
          </CardContent>
        </Card>
        {group.successRate !== undefined ? (
          <Card>
            <CardContent className="p-4 pt-4">
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                Success rate
              </p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {formatPercent(group.successRate, { decimals: 1, already100: true })}
              </p>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">Pending retries</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {group.pendingRetries ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">Last activity</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {group.lastActivityAt ? formatRelativeTime(group.lastActivityAt) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {health?.status && health.status !== 'healthy' ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4 pt-4">
            <div>
              <p className="text-sm font-medium text-foreground">Group health</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The group is reporting a non-healthy state.
              </p>
            </div>
            <Badge variant={health.status === 'degraded' ? 'warning' : 'destructive'}>
              {health.status}
            </Badge>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="destinations">
        <TabsList>
          <TabsTrigger value="destinations">Destinations</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="destinations">
          <Destinations groupId={groupId} />
        </TabsContent>
        <TabsContent value="operations">
          <Operations groupId={groupId} />
        </TabsContent>
        <TabsContent value="reconciliation">
          <Reconciliation groupId={groupId} />
        </TabsContent>
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Row label="Event types" value={(group.eventTypes ?? []).join(', ') || '—'} />
              <Row
                label="Sizing policy"
                value={group.sizingPolicy?.type?.replace(/_/g, ' ') ?? '—'}
              />
              <Row
                label="Execution mode"
                value={group.executionMode?.replace(/_/g, ' ') ?? '—'}
              />
              <Row label="Version" value={group.version ?? '1'} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={pauseDialogOpen}
        onOpenChange={setPauseDialogOpen}
        title="Pause sync group?"
        description="New eligible dispatches will stop. Existing orders already submitted to exchanges are not automatically cancelled and remain tracked."
        confirmLabel="Pause group"
        variant="warning"
        onConfirm={handlePause}
        isLoading={actionPending}
      />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}