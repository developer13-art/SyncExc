import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Settings2 } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { ConnectionStatusBadge } from '../../components/domain/connection/ConnectionStatusBadge.jsx';
import { ConnectionHealthBadge } from '../../components/domain/connection/ConnectionHealthBadge.jsx';
import { PermissionChecklist } from './components/PermissionChecklist.jsx';
import { ConnectionAccounts } from './ConnectionAccounts.jsx';
import { ConnectionHealth } from './ConnectionHealth.jsx';
import { ConnectionInstruments } from './ConnectionInstruments.jsx';
import { ConnectionBalances } from './ConnectionBalances.jsx';
import { useConnection } from '../../hooks/useConnections.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function ConnectionDetails() {
  const { connectionId } = useParams();
  const dispatch = useDispatch();

  const connectionQuery = useConnection(connectionId);
  const { connection, health, permissions, isLoading, error } = connectionQuery;

  useEffect(() => {
    if (connection) {
      dispatch(uiActions.setPageTitle(connection.label ?? connection.exchangeName));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Connections', path: ROUTES.app.connections.overview },
          {
            label: connection.label ?? connection.exchangeName,
            path: ROUTES.app.connections.details(connection.id),
          },
        ]),
      );
    }
  }, [connection, dispatch]);

  if (isLoading) {
    return <LoadingState label="Loading connection" />;
  }

  if (error || !connection) {
    return (
      <ErrorState
        title="Unable to load connection"
        description="This connection could not be retrieved."
        onRetry={connectionQuery.connection ? undefined : () => window.location.reload()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.connections.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {connection.label ?? connection.exchangeName}
            </h1>
            <ConnectionStatusBadge status={connection.status} />
            <ConnectionHealthBadge status={health?.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {connection.exchangeName}
            {connection.environment ? ` · ${connection.environment}` : ''}
            {connection.lastSyncedAt
              ? ` · Last sync ${formatDateTime(connection.lastSyncedAt)}`
              : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <IconButton
            label="Refresh"
            onClick={() => connectionQuery.refetch?.()}
            className="border border-border"
          >
            <RefreshCw className="h-4 w-4" />
          </IconButton>
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.connections.rotate(connection.id)}>
              <Settings2 className="h-4 w-4" /> Rotate credentials
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verified permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <PermissionChecklist permissions={permissions ?? {}} />
        </CardContent>
      </Card>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="instruments">Instruments</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          <ConnectionAccounts connectionId={connection.id} />
        </TabsContent>
        <TabsContent value="balances">
          <ConnectionBalances connectionId={connection.id} />
        </TabsContent>
        <TabsContent value="instruments">
          <ConnectionInstruments connectionId={connection.id} />
        </TabsContent>
        <TabsContent value="health">
          <ConnectionHealth connectionId={connection.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}