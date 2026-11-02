import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { RunStatusBadge } from '../../components/domain/workflow/RunStatusBadge.jsx';
import { useWorkflowRuns } from '../../hooks/useAutomation.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export function WorkflowRuns({ workflowId }) {
  const [status, setStatus] = useState('all');
  const [cursors, setCursors] = useState([null]);
  const page = cursors.length;
  const cursor = cursors[page - 1];

  const runsQuery = useWorkflowRuns({
    workflowId,
    status: status === 'all' ? undefined : status,
    limit: 25,
    cursor,
  });

  const runs = runsQuery.runs ?? [];
  const nextCursor = runsQuery.meta?.nextCursor;
  const totalPages = page + (nextCursor ? 1 : 0);

  useEffect(() => {
    setCursors([null]);
  }, [workflowId, status]);

  const changePage = (targetPage) => {
    if (targetPage < page) {
      setCursors((current) => current.slice(0, targetPage));
    } else if (targetPage === page + 1 && nextCursor) {
      setCursors((current) => [...current, nextCursor]);
    }
  };

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
          to={ROUTES.app.automation.run(row.id)}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.id?.slice(0, 12) ?? '—'}
        </Link>
      ),
    },
    {
      key: 'triggerType',
      label: 'Trigger',
      render: (row) => (
        <span className="text-xs text-foreground">
          {row.triggerType?.replace(/_/g, ' ') ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <RunStatusBadge status={row.status ?? row.state} />,
    },
    {
      key: 'durationMs',
      label: 'Duration',
      align: 'right',
      render: (row) =>
        row.durationMs !== undefined ? `${(row.durationMs / 1000).toFixed(1)}s` : '—',
    },
    {
      key: 'stepsExecuted',
      label: 'Steps',
      align: 'right',
      render: (row) => row.stepsExecuted ?? '—',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Runs</CardTitle>
          <div className="flex gap-2">
            <SegmentedControl
              options={[
                { value: 'all', label: 'All' },
                { value: 'succeeded', label: 'Succeeded' },
                { value: 'failed', label: 'Failed' },
                { value: 'running', label: 'Running' },
              ]}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setCursors([null]);
              }}
            />
            <IconButton
              label="Refresh"
              onClick={() => runsQuery.refetch?.()}
              className="border border-border"
            >
              <RefreshCw
                className={runsQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
              />
            </IconButton>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {runsQuery.error ? (
          <ErrorState
            title="Unable to load workflow runs"
            description="Run history could not be retrieved."
            onRetry={runsQuery.refetch}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={runs}
            isLoading={runsQuery.isLoading}
            emptyTitle="No runs yet"
            emptyDescription="Runs appear here when the workflow is triggered."
          />
        )}

        {totalPages > 1 ? (
          <div className="mt-4 flex justify-end">
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={changePage}
              hasNext={Boolean(nextCursor)}
              hasPrev={page > 1}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}