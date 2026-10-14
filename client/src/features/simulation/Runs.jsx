import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { RunStatusBadge } from '../../components/domain/workflow/RunStatusBadge.jsx';
import { useSimulationRuns } from '../../hooks/useSimulation.js';
import { usePagination } from '../../hooks/usePagination.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function Runs() {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const environmentId = searchParams.get('environmentId');
  const [status, setStatus] = useState('all');
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Simulation Runs'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Simulation', path: ROUTES.app.simulation.overview },
        { label: 'Runs', path: ROUTES.app.simulation.runs },
      ]),
    );
  }, [dispatch]);

  const runsQuery = useSimulationRuns({
    environmentId: environmentId ?? undefined,
    status: status === 'all' ? undefined : status,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const runs = runsQuery.runs ?? [];

  if (runsQuery.meta?.total !== undefined) {
    pagination.setTotal(runsQuery.meta.total);
  }

  const columns = [
    {
      key: 'startedAt',
      label: 'Started',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.startedAt ? formatRelativeTime(row.startedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Run',
      render: (row) => (
        <Link
          to={ROUTES.app.simulation.run(row.id)}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.id?.slice(0, 12) ?? '—'}
        </Link>
      ),
    },
    {
      key: 'environmentName',
      label: 'Environment',
      render: (row) => (
        <span className="text-xs text-foreground">{row.environmentName ?? '—'}</span>
      ),
    },
    {
      key: 'datasetName',
      label: 'Dataset',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.datasetName ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <RunStatusBadge status={row.status} />,
    },
    {
      key: 'durationMs',
      label: 'Duration',
      align: 'right',
      render: (row) =>
        row.durationMs !== undefined ? `${(row.durationMs / 1000).toFixed(1)}s` : '—',
    },
    {
      key: 'progress',
      label: 'Progress',
      align: 'right',
      render: (row) =>
        row.progress !== undefined ? `${(row.progress * 100).toFixed(0)}%` : '—',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Simulation Runs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Backtests, replays, and scenario evaluations. Every run preserves its inputs,
            assumptions, and warnings.
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={() => runsQuery.refetch?.()}
          className="border border-border"
        >
          <RefreshCw className={runsQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
      </div>

      <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />

      <Card>
        <CardContent className="p-5 pt-5">
          <DataTable
            columns={columns}
            rows={runs}
            isLoading={runsQuery.isLoading}
            emptyTitle="No simulation runs"
            emptyDescription="Start a run from an environment to see results here."
          />

          {pagination.total > pagination.pageSize ? (
            <div className="mt-4 flex justify-end">
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={pagination.goToPage}
                hasNext={pagination.hasNext}
                hasPrev={pagination.hasPrev}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}