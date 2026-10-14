import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Play } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { MetricsTable } from './components/MetricsTable.jsx';
import { useSimulationEnvironment } from '../../hooks/useSimulation.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function EnvironmentDetails() {
  const { environmentId } = useParams();
  const dispatch = useDispatch();

  const envQuery = useSimulationEnvironment(environmentId);
  const { environment, versions, isLoading, error } = envQuery;

  useEffect(() => {
    if (environment) {
      dispatch(uiActions.setPageTitle(environment.name));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Simulation', path: ROUTES.app.simulation.overview },
          { label: 'Environments', path: ROUTES.app.simulation.environments },
          {
            label: environment.name,
            path: ROUTES.app.simulation.environment(environment.id),
          },
        ]),
      );
    }
  }, [environment, dispatch]);

  if (isLoading) {
    return <LoadingState label="Loading environment" />;
  }

  if (error || !environment) {
    return (
      <ErrorState
        title="Unable to load environment"
        description="This environment could not be retrieved."
        onRetry={envQuery.refetch}
      />
    );
  }

  const isReady =
    environment.status === 'ready' || environment.status === 'completed';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.simulation.environments}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FlaskConical className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {environment.name}
            </h1>
            <Badge variant={isReady ? 'success' : 'warning'}>
              {environment.status ?? 'draft'}
            </Badge>
          </div>
          {environment.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{environment.description}</p>
          ) : null}
        </div>
        <Button asChild>
          <Link to={`${ROUTES.app.simulation.runs}?environmentId=${environment.id}`}>
            <Play className="h-4 w-4" /> View runs
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Type" value={environment.type?.replace(/_/g, ' ') ?? '—'} />
          <Field label="Virtual balance" value={environment.virtualBalance ?? '—'} />
          <Field label="Base currency" value={environment.baseCurrency ?? '—'} />
          <Field
            label="Created"
            value={environment.createdAt ? formatDateTime(environment.createdAt) : '—'}
          />
          <Field label="Runs" value={environment.runCount ?? 0} />
          <Field
            label="Instruments"
            value={environment.instrumentCount ?? 0}
          />
          <Field
            label="Last activity"
            value={
              environment.lastActivityAt ? formatDateTime(environment.lastActivityAt) : '—'
            }
          />
          <Field label="Owner" value={environment.ownerName ?? '—'} />
        </CardContent>
      </Card>

      {environment.latestMetrics ? (
        <MetricsTable metrics={environment.latestMetrics} />
      ) : null}

      {versions?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuration versions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className="flex items-start justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Version {version.version}
                    </p>
                    {version.changeSummary ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {version.changeSummary}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-2xs text-muted-foreground">
                    {version.createdAt ? formatDateTime(version.createdAt) : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          Simulation records are isolated from live execution. Resetting or deleting this
          environment does not modify live account data, order history, subscription records,
          or exchange credentials.
        </CardContent>
      </Card>
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