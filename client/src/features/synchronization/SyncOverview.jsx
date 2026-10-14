import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Activity, Plus, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { SyncGroupCard } from './components/SyncGroupCard.jsx';
import { useSyncGroups } from '../../hooks/useSync.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatPercent } from '../../lib/formatters/percent.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'needs_attention', label: 'Attention' },
];

export default function SyncOverview() {
  const dispatch = useDispatch();
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Synchronization'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Synchronization', path: ROUTES.app.synchronization.overview },
      ]),
    );
  }, [dispatch]);

  const params = {
    status: statusFilter === 'all' ? undefined : statusFilter,
  };

  const groupsQuery = useSyncGroups(params);
  const groups = groupsQuery.data?.items ?? [];

  const totalOperations = groups.reduce((sum, g) => sum + (g.operationCount ?? 0), 0);
  const overallSuccess = (() => {
    const withRate = groups.filter((g) => typeof g.successRate === 'number');
    if (withRate.length === 0) {
      return undefined;
    }
    const total = withRate.reduce((sum, g) => sum + g.successRate, 0);
    return total / withRate.length;
  })();
  const totalPendingRetries = groups.reduce((sum, g) => sum + (g.pendingRetries ?? 0), 0);
  const unresolvedCount = groups.reduce((sum, g) => sum + (g.unresolvedCount ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Synchronization
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Coordinate eligible trading activity across authorized exchange accounts with
            per-destination sizing and risk checks.
          </p>
        </div>
        <Button asChild>
          <Link to={ROUTES.app.synchronization.create}>
            <Plus className="h-4 w-4" /> New sync group
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sync groups"
          value={groups.length}
          hint={`${groups.filter((g) => g.status === 'active').length} active`}
          icon={Activity}
        />
        <StatCard
          label="Total operations"
          value={totalOperations}
          hint="Across all groups"
        />
        {overallSuccess !== undefined ? (
          <StatCard
            label="Success rate"
            value={formatPercent(overallSuccess, { decimals: 1, already100: true })}
            tone={
              overallSuccess >= 0.95
                ? 'success'
                : overallSuccess >= 0.8
                  ? 'warning'
                  : 'destructive'
            }
          />
        ) : null}
        <StatCard
          label="Pending retries"
          value={totalPendingRetries}
          hint={unresolvedCount > 0 ? `${unresolvedCount} unresolved` : 'None outstanding'}
          tone={
            unresolvedCount > 0
              ? 'destructive'
              : totalPendingRetries > 0
                ? 'warning'
                : 'default'
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          options={STATUS_FILTERS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <IconButton
          label="Refresh"
          onClick={() => groupsQuery.refetch()}
          disabled={groupsQuery.isLoading}
          className="border border-border"
        >
          <RefreshCw className={groupsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
      </div>

      {groupsQuery.isLoading ? (
        <LoadingState label="Loading sync groups" />
      ) : groupsQuery.isError ? (
        <ErrorState
          title="Unable to load sync groups"
          description="We could not fetch your synchronization groups."
          onRetry={groupsQuery.refetch}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={statusFilter === 'all' ? 'No sync groups yet' : 'No matching groups'}
          description={
            statusFilter === 'all'
              ? 'Create a sync group to coordinate source events across authorized destination accounts.'
              : 'Try adjusting the status filter.'
          }
          action={
            statusFilter === 'all' ? (
              <Button asChild>
                <Link to={ROUTES.app.synchronization.create}>Create sync group</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <SyncGroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}