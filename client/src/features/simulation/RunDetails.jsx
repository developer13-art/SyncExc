import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, FileText, XCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { RunStatusBadge } from '../../components/domain/workflow/RunStatusBadge.jsx';
import { MetricsTable } from './components/MetricsTable.jsx';
import { useSimulationRun } from '../../hooks/useSimulation.js';
import { simulationApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function RunDetails() {
  const { runId } = useParams();
  const toast = useToast();
  const runQuery = useSimulationRun(runId);

  if (runQuery.isLoading) {
    return <LoadingState label="Loading run" />;
  }

  if (runQuery.error || !runQuery.run) {
    return (
      <ErrorState
        title="Unable to load run"
        description="This simulation run could not be retrieved."
        onRetry={runQuery.refetch}
      />
    );
  }

  const run = runQuery.run;
  const canCancel = ['running', 'queued', 'paused'].includes(run.status);

  const handleCancel = async () => {
    try {
      await simulationApi.cancelRun(runId);
      toast.success('Cancellation requested');
      await runQuery.refetch?.();
    } catch (err) {
      toast.error('Cancellation failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.simulation.runs}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Run {run.id?.slice(0, 12)}
            </h1>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {run.environmentName ?? 'Environment'} ·{' '}
            {run.startedAt ? formatDateTime(run.startedAt) : '—'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.simulation.runReport(run.id)}>
              <FileText className="h-4 w-4" /> Report
            </Link>
          </Button>
          {canCancel ? (
            <Button variant="outline" onClick={handleCancel}>
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Environment" value={run.environmentName ?? '—'} />
          <Field label="Dataset" value={run.datasetName ?? '—'} />
          <Field label="Strategy" value={run.strategyName ?? '—'} />
          <Field label="Fill model" value={run.fillModel?.replace(/_/g, ' ') ?? '—'} />
          <Field
            label="Start"
            value={run.startedAt ? formatDateTime(run.startedAt) : '—'}
          />
          <Field
            label="End"
            value={run.completedAt ? formatDateTime(run.completedAt) : '—'}
          />
          <Field
            label="Duration"
            value={run.durationMs !== undefined ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
          />
          <Field label="Seed" value={run.seed ?? '—'} />
        </CardContent>
      </Card>

      {run.warnings?.length > 0 ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 pt-4">
            <p className="text-xs font-semibold text-warning">Warnings</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {run.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {run.metrics ? <MetricsTable metrics={run.metrics} /> : null}

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="fills">Fills</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <Card>
            <CardContent className="p-5 pt-5 text-sm text-muted-foreground">
              Order list will be shown here. Every simulated order retains its calculation
              method and fill model reference.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="fills">
          <Card>
            <CardContent className="p-5 pt-5 text-sm text-muted-foreground">
              Simulated fills carry an explicit model reference. Where the data cannot support a
              realistic fill, the result is labelled as an estimate.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="positions">
          <Card>
            <CardContent className="p-5 pt-5 text-sm text-muted-foreground">
              Position snapshots are preserved with their observation timestamps.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="events">
          <Card>
            <CardContent className="p-5 pt-5 text-sm text-muted-foreground">
              The event ledger shows every event processed by the simulation engine.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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