import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Building2, Filter, Plus, Search } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { ConnectionCard } from './components/ConnectionCard.jsx';
import { DisconnectDialog } from './components/DisconnectDialog.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { useConnections } from '../../hooks/useConnections.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'suspended', label: 'Suspended' },
];

export default function ConnectionsOverview() {
  const dispatch = useDispatch();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [disconnectTarget, setDisconnectTarget] = useState(null);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Exchange Connections'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Connections', path: ROUTES.app.connections.overview },
      ]),
    );
  }, [dispatch]);

  const params = {
    status: statusFilter === 'all' ? undefined : statusFilter,
    q: query || undefined,
  };

  const connectionsQuery = useConnections(params);
  const { suspendConnection, disconnect } = useConnections();

  const connections = connectionsQuery.data?.items ?? [];

  const handleSuspend = async () => {
    if (!suspendTarget) {
      return;
    }
    try {
      await suspendConnection({
        connectionId: suspendTarget.id,
        reason: 'User-requested suspension',
      });
      toast.success('Connection suspended');
      setSuspendTarget(null);
    } catch (error) {
      toast.error('Suspension failed', { description: getErrorMessage(error) });
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectTarget) {
      return;
    }
    try {
      await disconnect({ connectionId: disconnectTarget.id });
      toast.success('Connection disconnected');
      setDisconnectTarget(null);
    } catch (error) {
      toast.error('Disconnection failed', { description: getErrorMessage(error) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Exchange Connections
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Authorized API integrations to supported exchanges. Credentials are encrypted and
            never exposed.
          </p>
        </div>
        <Button asChild>
          <Link to={ROUTES.app.connections.create}>
            <Plus className="h-4 w-4" /> Connect exchange
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search connections…"
          className="w-full max-w-xs"
        />
        <SegmentedControl
          options={STATUS_FILTERS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      {connectionsQuery.isLoading ? (
        <LoadingState label="Loading connections" />
      ) : connectionsQuery.isError ? (
        <ErrorState
          title="Unable to load connections"
          description="We could not fetch your connections. Please try again."
          onRetry={connectionsQuery.refetch}
        />
      ) : connections.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={
            query || statusFilter !== 'all'
              ? 'No matching connections'
              : 'No connections yet'
          }
          description={
            query || statusFilter !== 'all'
              ? 'Try adjusting your filters or search query.'
              : 'Connect a supported exchange to start monitoring your accounts and configuring synchronization.'
          }
          action={
            !query && statusFilter === 'all' ? (
              <Button asChild>
                <Link to={ROUTES.app.connections.create}>Connect exchange</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {connections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onSuspend={setSuspendTarget}
              onDisconnect={setDisconnectTarget}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
        title="Suspend connection?"
        description="Suspending blocks new operations that depend on this connection. Existing orders at the exchange are not affected."
        confirmLabel="Suspend"
        variant="warning"
        onConfirm={handleSuspend}
      />

      <DisconnectDialog
        open={Boolean(disconnectTarget)}
        onOpenChange={(open) => !open && setDisconnectTarget(null)}
        connection={disconnectTarget}
        onConfirm={handleDisconnect}
      />
    </div>
  );
}