import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, RotateCcw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { RolloutForm } from './RolloutForm.jsx';
import { RollbackDialog } from './RollbackDialog.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { featureFlagsApi } from '../../api/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

const STATUS_VARIANTS = {
  pending: 'warning',
  active: 'success',
  paused: 'muted',
  completed: 'info',
  rolled_back: 'destructive',
  failed: 'destructive',
};

export default function FlagRollouts() {
  const { flagId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [rolloutOpen, setRolloutOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState(null);

  const rolloutsQuery = useQuery({
    queryKey: ['feature-flag', flagId, 'rollouts'],
    queryFn: () => featureFlagsApi.rollouts(flagId),
    enabled: Boolean(flagId),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => featureFlagsApi.initiateRollout(flagId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flag', flagId, 'rollouts'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flag', flagId] });
      toast.success('Rollout initiated');
      setRolloutOpen(false);
    },
    onError: (err) => {
      toast.error('Rollout failed', { description: getErrorMessage(err) });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (payload) => featureFlagsApi.requestRollback(flagId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flag', flagId, 'rollouts'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flag', flagId] });
      toast.success('Rollback requested');
      setRollbackTarget(null);
    },
    onError: (err) => {
      toast.error('Rollback failed', { description: getErrorMessage(err) });
    },
  });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Flag Rollouts'));
    dispatch(
      adminUiActions.setBreadcrumbs([
        { label: 'Feature Flags', path: '/feature-flags' },
        { label: 'Flag', path: `/feature-flags/${flagId}` },
        { label: 'Rollouts', path: `/feature-flags/${flagId}/rollouts` },
      ]),
    );
  }, [dispatch, flagId]);

  const rollouts = rolloutsQuery.data ?? [];

  const columns = [
    {
      key: 'startedAt',
      label: 'Started',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.startedAt ? formatDateTime(row.startedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'targetingRule',
      label: 'Targeting',
      render: (row) => (
        <span className="text-xs text-foreground">
          {row.targetingRuleSummary ?? '—'}
        </span>
      ),
    },
    {
      key: 'percentage',
      label: 'Percentage',
      align: 'right',
      render: (row) => (row.percentage !== undefined ? `${row.percentage}%` : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'muted'}>
          {row.status?.replace(/_/g, ' ') ?? 'pending'}
        </Badge>
      ),
    },
    {
      key: 'errorRate',
      label: 'Error rate',
      align: 'right',
      render: (row) =>
        row.errorRate !== undefined ? (
          <span
            className={
              row.errorRate > 0.05
                ? 'text-destructive'
                : row.errorRate > 0.01
                  ? 'text-warning'
                  : 'text-foreground'
            }
          >
            {(row.errorRate * 100).toFixed(2)}%
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) =>
        row.status === 'active' ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setRollbackTarget(row)}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Rollback
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/feature-flags/${flagId}`}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Flag Rollouts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Staged rollouts with monitoring. Expand gradually or roll back based on error rate
            and impact.
          </p>
        </div>
        <Button onClick={() => setRolloutOpen(true)}>
          <Plus className="h-4 w-4" /> New rollout
        </Button>
      </div>

      {rolloutsQuery.isLoading ? (
        <LoadingState label="Loading rollouts" />
      ) : rollouts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No rollouts have been started for this flag.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={rollouts} />
          </CardContent>
        </Card>
      )}

      <RolloutForm
        open={rolloutOpen}
        onOpenChange={setRolloutOpen}
        flagId={flagId}
        onSubmit={(payload) => createMutation.mutate(payload)}
        isSubmitting={createMutation.isPending}
      />

      <RollbackDialog
        open={Boolean(rollbackTarget)}
        onOpenChange={(open) => !open && setRollbackTarget(null)}
        rollout={rollbackTarget}
        onSubmit={(payload) => rollbackMutation.mutate(payload)}
        isSubmitting={rollbackMutation.isPending}
      />
    </div>
  );
}