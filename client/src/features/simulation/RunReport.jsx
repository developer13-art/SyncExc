import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, FileText } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { MetricsTable } from './components/MetricsTable.jsx';
import { useSimulationRun } from '../../hooks/useSimulation.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { downloadJson } from '../../lib/utils/download.util.js';
import { ROUTES } from '../../config/routes.config.js';

export default function RunReport() {
  const { runId } = useParams();
  const runQuery = useSimulationRun(runId);

  if (runQuery.isLoading) {
    return <LoadingState label="Loading report" />;
  }

  if (runQuery.error || !runQuery.report) {
    return (
      <ErrorState
        title="Unable to load report"
        description="This simulation report could not be retrieved."
        onRetry={runQuery.refetch}
      />
    );
  }

  const report = runQuery.report;

  const handleExport = () => {
    downloadJson(report, `simulation-report-${runId}.json`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.simulation.run(runId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Simulation report
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Run {runId?.slice(0, 12)} · Generated{' '}
            {report.generatedAt ? formatDateTime(report.generatedAt) : '—'}
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export JSON
        </Button>
      </div>

      {report.limitations?.length > 0 ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-warning">Known limitations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {report.limitations.map((limitation, i) => (
                <li key={i}>{limitation}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {report.summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Status" value={report.summary.status} />
            <Field label="Timeframe" value={report.summary.timeframe} />
            <Field label="Strategy version" value={report.summary.strategyVersion} />
            <Field label="Environment" value={report.summary.environmentName} />
          </CardContent>
        </Card>
      ) : null}

      {report.configuration ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Object.entries(report.configuration).map(([key, value]) => (
              <Field
                key={key}
                label={key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                value={value}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {report.dataQuality ? (
        <Card>
          <CardHeader>
            <CardTitle>Data quality</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
            {Object.entries(report.dataQuality).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-3">
                <span>{key.replace(/_/g, ' ')}</span>
                <span className="text-foreground">{String(value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {report.metrics ? <MetricsTable metrics={report.metrics} /> : null}

      {report.reproducibility ? (
        <Card>
          <CardHeader>
            <CardTitle>Reproducibility</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
            {Object.entries(report.reproducibility).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-3">
                <span>{key.replace(/_/g, ' ')}</span>
                <span className="font-mono text-2xs text-foreground">{String(value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {report.runId ? (
        <div className="flex justify-end">
          <Badge variant="muted">Run {report.runId}</Badge>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value ?? '—'}</p>
    </div>
  );
}