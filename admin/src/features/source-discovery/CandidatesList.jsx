import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Compass, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { usePagination } from '../../hooks/usePagination.js';
import { sourceDiscoveryApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

const STATUS_FILTERS = [
  { value: 'pending_review', label: 'Pending review' },
  { value: 'additional_information_required', label: 'Info required' },
  { value: 'approved_for_validation', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const STATUS_VARIANTS = {
  pending_review: 'warning',
  additional_information_required: 'warning',
  approved_for_validation: 'info',
  validation_in_progress: 'info',
  approved: 'success',
  rejected: 'destructive',
  suspended: 'destructive',
};

export default function CandidatesList() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('pending_review');
  const [query, setQuery] = useState('');
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Source Discovery'));
    dispatch(
      adminUiActions.setBreadcrumbs([
        { label: 'Source Discovery', path: '/source-discovery' },
      ]),
    );
  }, [dispatch]);

  const candidatesQuery = useQuery({
    queryKey: ['source-discovery', 'candidates', { status, query, page: pagination.page }],
    queryFn: () =>
      sourceDiscoveryApi.candidates({
        status: status === 'all' ? undefined : status,
        q: query || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const candidates = candidatesQuery.data?.items ?? [];

  useEffect(() => {
    const total = candidatesQuery.data?.meta?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [candidatesQuery.data?.meta?.total, pagination.setTotal]);

  const columns = [
    {
      key: 'name',
      label: 'Candidate',
      render: (row) => (
        <Link
          to={`/source-discovery/${row.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {row.name ?? row.proposedName ?? row.id?.slice(0, 12)}
        </Link>
      ),
    },
    {
      key: 'platform',
      label: 'Platform',
      render: (row) => <Badge variant="muted">{row.platform ?? '—'}</Badge>,
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
      key: 'confidence',
      label: 'AI confidence',
      align: 'right',
      render: (row) =>
        row.confidence !== undefined ? `${(row.confidence * 100).toFixed(0)}%` : '—',
    },
    {
      key: 'reviewerAssignedTo',
      label: 'Reviewer',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.reviewerAssignedTo ?? 'unassigned'}
        </span>
      ),
    },
    {
      key: 'discoveredAt',
      label: 'Discovered',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.discoveredAt ? formatRelativeTime(row.discoveredAt) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Source Discovery
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discovered source candidates awaiting review. AI-generated classifications are
          distinguished from provider-reported or system-observed facts.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search candidates…"
          className="w-full max-w-xs"
        />
        <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
        <IconButton
          label="Refresh"
          onClick={() => candidatesQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw
            className={candidatesQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      {candidatesQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : candidates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Compass className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No candidates match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={candidates} />

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