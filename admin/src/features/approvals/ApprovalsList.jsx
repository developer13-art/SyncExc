import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { CheckSquare, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { ApprovalDecisionDialog } from './ApprovalDecisionDialog.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { usePagination } from '../../hooks/usePagination.js';
import { approvalsApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'all', label: 'All' },
];

const STATUS_VARIANTS = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  expired: 'muted',
  revoked: 'muted',
};

export default function ApprovalsList() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('pending');
  const [decision, setDecision] = useState(null);
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Approvals'));
    dispatch(adminUiActions.setBreadcrumbs([{ label: 'Approvals', path: '/approvals' }]));
  }, [dispatch]);

  const approvalsQuery = useQuery({
    queryKey: ['approvals', { status, page: pagination.page }],
    queryFn: () =>
      approvalsApi.list({
        status: status === 'all' ? undefined : status,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const approvals = approvalsQuery.data?.items ?? [];

  useEffect(() => {
    const total = approvalsQuery.data?.meta?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [approvalsQuery.data?.meta?.total, pagination.setTotal]);

  const columns = [
    {
      key: 'id',
      label: 'Approval',
      render: (row) => (
        <span className="font-mono text-xs text-foreground">{row.id?.slice(0, 12)}</span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <span className="text-sm text-foreground">
          {row.action?.replace(/_/g, ' ') ?? '—'}
        </span>
      ),
    },
    {
      key: 'requester',
      label: 'Requester',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.requesterName ?? row.requesterId ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'muted'}>
          {row.status ?? 'pending'}
        </Badge>
      ),
    },
    {
      key: 'requiresSecondApprover',
      label: 'Second approver',
      render: (row) =>
        row.requiresSecondApprover ? (
          <Badge variant="info" size="sm">
            Required
          </Badge>
        ) : null,
    },
    {
      key: 'createdAt',
      label: 'Requested',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatRelativeTime(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) =>
        row.status === 'pending' ? (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDecision({ action: 'reject', approval: row })}
            >
              Reject
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDecision({ action: 'approve', approval: row })}
            >
              Approve
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Approvals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Actions requiring additional authorization. The requester cannot approve their own
            action when separation of duties is required.
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={() => approvalsQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw
            className={approvalsQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />

      {approvalsQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : approvals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckSquare className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No approvals match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={approvals} />

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
      )}

      <ApprovalDecisionDialog
        open={Boolean(decision)}
        onOpenChange={(open) => !open && setDecision(null)}
        decision={decision?.action}
        approval={decision?.approval}
      />
    </div>
  );
}