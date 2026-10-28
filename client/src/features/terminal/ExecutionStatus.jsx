import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import { DataTable } from '../../components/ui/DataTable.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useTerminalExecutions } from '../../hooks/useTerminal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

const STATUS_MAP = {
  pending: { label: 'Pending', variant: 'muted' },
  validating: { label: 'Validating', variant: 'warning' },
  submitting: { label: 'Submitting', variant: 'warning' },
  acknowledged: { label: 'Acknowledged', variant: 'info' },
  partially_executed: { label: 'Partial', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  failed: { label: 'Failed', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
  reconciliation_required: { label: 'Reconciliation', variant: 'destructive' },
};

export function ExecutionStatus({ workspaceId, accountId }) {
  const toast = useToast();
  const pagination = usePagination({ initialPageSize: 50 });
  const [reconcilingId, setReconcilingId] = useState(null);

  const executionsQuery = useTerminalExecutions(workspaceId, {
    accountId: accountId ?? undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const executions = executionsQuery.data?.items ?? [];

  useEffect(() => {
    const total = executionsQuery.data?.meta?.total;
    if (total !== undefined) {
      pagination.setTotal(total);
    }
  }, [executionsQuery.data?.meta?.total, pagination.setTotal]);

  const handleReconcile = async (executionId) => {
    setReconcilingId(executionId);
    try {
      await executionsQuery.requestReconciliation(executionId);
      toast.success('Reconciliation requested', {
        description: 'The platform will verify authoritative state.',
      });
    } catch (error) {
      toast.error('Reconciliation failed', { description: getErrorMessage(error) });
    } finally {
      setReconcilingId(null);
    }
  };

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
      key: 'operationId',
      label: 'Operation',
      render: (row) => (
        <Link
          to={ROUTES.app.terminal.execution(row.id)}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.id?.slice(0, 12) ?? '—'}
        </Link>
      ),
    },
    {
      key: 'instrument',
      label: 'Instrument',
      render: (row) => <span className="font-medium text-foreground">{row.instrument ?? '—'}</span>,
    },
    { key: 'side', label: 'Side' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const config = STATUS_MAP[row.status] ?? { label: row.status, variant: 'muted' };
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
    },
    {
      key: 'attempts',
      label: 'Attempts',
      align: 'right',
      render: (row) => row.attempts ?? 1,
    },
    {
      key: 'retryAt',
      label: 'Next retry',
      render: (row) =>
        row.retryAt ? (
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(row.retryAt)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.app.terminal.execution(row.id)}>Details</Link>
          </Button>
          {row.status === 'reconciliation_required' || row.status === 'acknowledged' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReconcile(row.id)}
              disabled={reconcilingId === row.id}
            >
              {reconcilingId === row.id ? 'Reconciling…' : 'Reconcile'}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <IconButton
          label="Refresh"
          onClick={() => executionsQuery.refetch()}
          disabled={executionsQuery.isLoading}
          className="border border-border"
        >
          <RefreshCw className={cn('h-4 w-4', executionsQuery.isFetching && 'animate-spin')} />
        </IconButton>
      </div>

      <DataTable
        columns={columns}
        rows={executions}
        isLoading={executionsQuery.isLoading}
        emptyTitle="No executions"
        emptyDescription="Execution records will appear here."
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
    </>
  );
}