import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Radio, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { usePagination } from '../../hooks/usePagination.js';
import { signalSourcesApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'needs_attention', label: 'Needs attention' },
];

const STATUS_VARIANTS = {
  active: 'success',
  pending_review: 'warning',
  paused: 'muted',
  suspended: 'destructive',
  needs_attention: 'warning',
  archived: 'muted',
};

export default function SourcesList() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Signal Sources'));
    dispatch(
      adminUiActions.setBreadcrumbs([{ label: 'Signal Sources', path: '/signal-sources' }]),
    );
  }, [dispatch]);

  const sourcesQuery = useQuery({
    queryKey: ['signal-sources', { status, query, page: pagination.page }],
    queryFn: () =>
      signalSourcesApi.list({
        status: status === 'all' ? undefined : status,
        q: query || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const sources = sourcesQuery.data?.items ?? [];

  useEffect(() => {
    const total = sourcesQuery.data?.meta?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [sourcesQuery.data?.meta?.total, pagination.setTotal]);

  const columns = [
    {
      key: 'name',
      label: 'Source',
      render: (row) => (
        <Link
          to={`/signal-sources/${row.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {row.name}
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
          {row.status?.replace(/_/g, '/') ?? 'unknown'}
        </Badge>
      ),
    },
    {
      key: 'ownerWorkspaceName',
      label: 'Owner',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.ownerWorkspaceName ?? '—'}
        </span>
      ),
    },
    {
      key: 'messageCount24h',
      label: '24h messages',
      align: 'right',
      render: (row) => row.messageCount24h ?? 0,
    },
    {
      key: 'parsingSuccessRate',
      label: 'Parsing',
      align: 'right',
      render: (row) =>
        row.parsingSuccessRate !== undefined
          ? `${(row.parsingSuccessRate * 100).toFixed(1)}%`
          : '—',
    },
    {
      key: 'lastEventAt',
      label: 'Last event',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.lastEventAt ? formatRelativeTime(row.lastEventAt) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Signal Sources
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational lifecycle of registered signal sources. Status, technical health, and
          content quality are tracked independently.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search sources…"
          className="w-full max-w-xs"
        />
        <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
        <IconButton
          label="Refresh"
          onClick={() => sourcesQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw
            className={sourcesQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      {sourcesQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : sources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Radio className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No sources match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={sources} />

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