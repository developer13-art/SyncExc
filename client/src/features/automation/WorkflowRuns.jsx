import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { RunStatusBadge } from '../../components/domain/workflow/RunStatusBadge.jsx';
import { useWorkflowRuns } from '../../hooks/useAutomation.js';
import { usePagination } from '../../hooks/usePagination.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export function WorkflowRuns({ workflowId }) {
  const pagination = usePagination({ initialPageSize: 25 });
  const [status, setStatus] = useState('all');

  const runsQuery = useWorkflowRuns({
    workflowId,
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
              onChange={setStatus}
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
        <DataTable
          columns={columns}
          rows={runs}
          isLoading={runsQuery.isLoading}
          emptyTitle="No runs yet"
          emptyDescription="Runs appear here when the workflow is triggered."
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
  );
}