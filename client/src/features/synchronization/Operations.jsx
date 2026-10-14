import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { OperationStatusBadge } from '../../components/domain/sync/OperationStatusBadge.jsx';
import { useSyncOperations } from '../../hooks/useSync.js';
import { usePagination } from '../../hooks/usePagination.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'partially_completed', label: 'Partial' },
  { value: 'failed', label: 'Failed' },
  { value: 'reconciliation_required', label: 'Reconciliation' },
];

export function Operations({ groupId }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const pagination = usePagination({ initialPageSize: 25 });

  const operationsQuery = useSyncOperations({
    groupId,
    status: statusFilter === 'all' ? undefined : statusFilter,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const operations = operationsQuery.operations ?? [];

  if (operationsQuery.meta?.total !== undefined) {
    pagination.setTotal(operationsQuery.meta.total);
  }

  const columns = [
    {
      key: 'createdAt',
      label: 'Time',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatRelativeTime(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Operation',
      render: (row) => (
        <Link
          to={ROUTES.app.synchronization.operation(row.id)}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.id?.slice(0, 12) ?? '—'}
        </Link>
      ),
    },
    {
      key: 'sourceEventType',
      label: 'Event',
      render: (row) => <span className="text-xs text-foreground">{row.sourceEventType ?? '—'}</span>,
    },
    {
      key: 'instrument',
      label: 'Instrument',
      render: (row) => <span className="font-medium text-foreground">{row.instrument ?? '—'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <OperationStatusBadge status={row.status} />,
    },
    {
      key: 'destinationCount',
      label: 'Destinations',
      align: 'right',
      render: (row) => row.destinationCount ?? '—',
    },
    {
      key: 'successCount',
      label: 'Succeeded',
      align: 'right',
      render: (row) => (
        <span className="text-success">{row.successCount ?? 0}</span>
      ),
    },
    {
      key: 'failedCount',
      label: 'Failed',
      align: 'right',
      render: (row) =>
        row.failedCount > 0 ? (
          <span className="text-destructive">{row.failedCount}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
  ];

  return (
    <Card>
      <CardContent className="p-5 pt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            options={STATUS_FILTERS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <IconButton
            label="Refresh"
            onClick={() => operationsQuery.refetch?.()}
            disabled={operationsQuery.isLoading}
            className="border border-border"
          >
            <RefreshCw className={cn('h-4 w-4', operationsQuery.isLoading && 'animate-spin')} />
          </IconButton>
        </div>

        <DataTable
          columns={columns}
          rows={operations}
          isLoading={operationsQuery.isLoading}
          emptyTitle="No operations"
          emptyDescription="Synchronization operations will appear here as they are processed."
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