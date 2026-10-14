import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Play } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { InfoCallout } from '../../components/ui/InfoCallout.jsx';
import { useDeveloperApplication } from '../../hooks/useDeveloper.js';
import { developerApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Sandbox() {
  const { applicationId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();

  const appQuery = useDeveloperApplication(applicationId);
  const [running, setRunning] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: queryKeys.developer.sandboxSessions(applicationId),
    queryFn: () => developerApi.listSandboxSessions(applicationId),
    enabled: Boolean(applicationId),
  });

  const testRunsQuery = useQuery({
    queryKey: queryKeys.developer.testRuns(applicationId, {}),
    queryFn: () => developerApi.listTestRuns(applicationId, {}),
    enabled: Boolean(applicationId),
  });

  useEffect(() => {
    if (appQuery.application) {
      dispatch(uiActions.setPageTitle('Sandbox'));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Developer', path: ROUTES.app.developer.overview },
          { label: 'Applications', path: ROUTES.app.developer.applications },
          {
            label: appQuery.application.name,
            path: ROUTES.app.developer.application(applicationId),
          },
          {
            label: 'Sandbox',
            path: ROUTES.app.developer.sandbox(applicationId),
          },
        ]),
      );
    }
  }, [appQuery.application, dispatch, applicationId]);

  if (appQuery.isLoading) {
    return <LoadingState label="Loading sandbox" />;
  }

  if (appQuery.error || !appQuery.application) {
    return (
      <ErrorState
        title="Unable to load sandbox"
        description="This application could not be retrieved."
        onRetry={appQuery.refetch}
      />
    );
  }

  const sessions = sessionsQuery.data ?? [];
  const testRuns = testRunsQuery.data?.items ?? [];

  const handleCreateSession = async () => {
    setRunning(true);
    try {
      const session = await developerApi.createSandboxSession(applicationId, {});
      toast.success('Sandbox session created', {
        description: 'Use the sandbox credential for testing only.',
      });
      sessionsQuery.refetch();
      void session;
    } catch (err) {
      toast.error('Failed to create session', { description: getErrorMessage(err) });
    } finally {
      setRunning(false);
    }
  };

  const columns = [
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatRelativeTime(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Test run',
      render: (row) => (
        <span className="text-sm font-medium text-foreground">
          {row.name ?? row.id?.slice(0, 12)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge
          variant={
            row.status === 'succeeded'
              ? 'success'
              : row.status === 'failed'
                ? 'destructive'
                : 'warning'
          }
        >
          {row.status ?? 'running'}
        </Badge>
      ),
    },
    {
      key: 'steps',
      label: 'Steps',
      align: 'right',
      render: (row) => row.stepCount ?? '—',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.developer.application(applicationId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Developer Sandbox
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Test integrations against synthetic data. Sandbox credentials do not authenticate
            to production endpoints, and sandbox requests never create live orders.
          </p>
        </div>
        <Button onClick={handleCreateSession} disabled={running}>
          <Play className="h-4 w-4" />
          {running ? 'Creating…' : 'New session'}
        </Button>
      </div>

      <InfoCallout>
        Sandbox data is clearly labeled as synthetic. The API returns distinguishable IDs, and
        any state created in sandbox is isolated from production resources.
      </InfoCallout>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No active sandbox sessions. Create one to begin testing.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {session.name ?? session.id?.slice(0, 12)}
                    </p>
                    <p className="text-2xs text-muted-foreground">
                      Created{' '}
                      {session.createdAt ? formatRelativeTime(session.createdAt) : ''}
                    </p>
                  </div>
                  <Badge variant={session.status === 'active' ? 'success' : 'muted'}>
                    {session.status ?? 'active'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test runs</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={columns}
            rows={testRuns}
            isLoading={testRunsQuery.isLoading}
            emptyTitle="No test runs"
            emptyDescription="Test runs against sandbox resources will appear here."
          />
        </CardContent>
      </Card>
    </div>
  );
}