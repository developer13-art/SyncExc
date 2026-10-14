import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PauseCircle, Pencil, PlayCircle, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { WorkflowVersions } from './WorkflowVersions.jsx';
import { Triggers } from './Triggers.jsx';
import { Schedules } from './Schedules.jsx';
import { WorkflowRuns } from './WorkflowRuns.jsx';
import { TestRuns } from './TestRuns.jsx';
import { useWorkflow, useWorkflows } from '../../hooks/useAutomation.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function WorkflowDetails() {
  const { workflowId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();

  const workflowQuery = useWorkflow(workflowId);
  const { pauseWorkflow, resumeWorkflow } = useWorkflows();

  const [pauseOpen, setPauseOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { workflow, isLoading, error } = workflowQuery;

  useEffect(() => {
    if (workflow) {
      dispatch(uiActions.setPageTitle(workflow.name));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Automation', path: ROUTES.app.automation.overview },
          { label: workflow.name, path: ROUTES.app.automation.workflow(workflow.id) },
        ]),
      );
    }
  }, [workflow, dispatch]);

  if (isLoading) {
    return <LoadingState label="Loading workflow" />;
  }

  if (error || !workflow) {
    return (
      <ErrorState
        title="Unable to load workflow"
        description="This workflow could not be retrieved."
        onRetry={workflowQuery.refetch}
      />
    );
  }

  const isActive = workflow.status === 'active';
  const isPaused = workflow.status === 'paused';

  const handlePause = async () => {
    setProcessing(true);
    try {
      await pauseWorkflow({ workflowId, reason: 'Manual pause' });
      toast.success('Workflow paused');
      setPauseOpen(false);
    } catch (err) {
      toast.error('Pause failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  const handleResume = async () => {
    setProcessing(true);
    try {
      await resumeWorkflow({ workflowId });
      toast.success('Workflow resumed');
    } catch (err) {
      toast.error('Resume failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.automation.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {workflow.name}
            </h1>
            <Badge
              variant={isActive ? 'success' : isPaused ? 'warning' : 'muted'}
            >
              {workflow.status ?? 'draft'}
            </Badge>
            {workflow.version !== undefined ? (
              <Badge variant="muted">v{workflow.version}</Badge>
            ) : null}
          </div>
          {workflow.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{workflow.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.automation.edit(workflow.id)}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
          {isActive ? (
            <Button variant="outline" onClick={() => setPauseOpen(true)} disabled={processing}>
              <PauseCircle className="h-4 w-4" /> Pause
            </Button>
          ) : isPaused ? (
            <Button onClick={handleResume} disabled={processing}>
              <PlayCircle className="h-4 w-4" /> Resume
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Total runs
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {workflow.runCount ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Success rate
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {workflow.successRate !== undefined
                ? `${(workflow.successRate * 100).toFixed(1)}%`
                : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Last run
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {workflow.lastRunAt ? formatDateTime(workflow.lastRunAt) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Active triggers
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {workflow.activeTriggerCount ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="triggers">
        <TabsList>
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="tests">Test runs</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>
        <TabsContent value="triggers">
          <Triggers workflowId={workflowId} />
        </TabsContent>
        <TabsContent value="schedules">
          <Schedules workflowId={workflowId} />
        </TabsContent>
        <TabsContent value="runs">
          <WorkflowRuns workflowId={workflowId} />
        </TabsContent>
        <TabsContent value="tests">
          <TestRuns workflowId={workflowId} />
        </TabsContent>
        <TabsContent value="versions">
          <WorkflowVersions workflowId={workflowId} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        title="Pause workflow?"
        description="No new runs will start. Queued runs follow the configured pause policy. In-flight external requests continue until their outcome is known."
        confirmLabel="Pause"
        variant="warning"
        onConfirm={handlePause}
        isLoading={processing}
      />
    </div>
  );
}