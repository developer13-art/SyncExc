import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Cpu, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { usePagination } from '../../hooks/usePagination.js';
import { operationJobsApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'waiting_for_approval', label: 'Awaiting approval' },
  { value: 'partially_succeeded', label: 'Partial' },
  { value: 'failed', label: 'Failed' },
  { value: 'reconciliation_required', label: 'Reconciliation' },
];

const STATUS_VARIANTS = {
  queued: 'muted',
  validating: 'warning',
  running: 'info',
  waiting_for_approval: 'warning',
  partially_succeeded: 'warning',
  succeeded: 'success',
  failed: 'destructive',
  cancellation_requested: 'muted',
  cancelled: 'muted',
  reconciliation_required: 'destructive',
};

export default function JobsList() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Operation Jobs'));
    dispatch(
      adminUiActions.setBreadcrumbs([{ label: 'Operation Jobs', path: '/operation-jobs' }]),
    );
  }, [dispatch]);

  const jobsQuery = useQuery({
    queryKey: ['operation-jobs', { status, query, page: pagination.page }],
    queryFn: () =>
      operationJobsApi.list({
        status: status === 'all' ? undefined : status,
        q: query || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const jobs = jobsQuery.data?.items ?? [];

  if (jobsQuery.data?.meta?.total !== undefined) {
    pagination.setTotal(jobsQuery.data.meta.total);
  }

  const columns = [
    {
      key: 'id',
      label: 'Job',
      render: (row) => (
        <Link
          to={`/operation-jobs/${row.id}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.id?.slice(0, 12) ?? '—'}
        </Link>
      ),
    },
    {
      key: 'operationType',
      label: 'Type',
      render: (row) => (
        <span className="text-xs text-foreground">
          {row.operationType?.replace(/_/g, ' ') ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'muted'}>
          {row.status?.replace(/_/g, ' ') ?? 'unknown'}
        </Badge>
      ),
    },
    {
      key: 'progress',
      label: 'Progress',
      align: 'right',
      render: (row) =>
        row.progress !== undefined ? `${(row.progress * 100).toFixed(0)}%` : '—',
    },
    {
      key: 'requestingAdmin',
      label: 'Requested by',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.requestingAdmin ?? '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Started',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatRelativeTime(row.createdAt) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Operation Jobs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Long-running administrative operations. Partial completions are reported honestly —
            jobs are never presented as all-or-nothing.
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={() => jobsQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw
            className={jobsQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search jobs…"
          className="w-full max-w-xs"
        />
        <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
      </div>

      {jobsQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Cpu className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No operation jobs match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={jobs} />

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
    </div>
  );
}