import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, ToggleRight } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { usePagination } from '../../hooks/usePagination.js';
import { featureFlagsApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'release', label: 'Release' },
  { value: 'operational_control', label: 'Operational' },
  { value: 'experiment', label: 'Experiment' },
  { value: 'emergency_kill_switch', label: 'Kill switch' },
];

const TYPE_VARIANTS = {
  release: 'info',
  operational_control: 'warning',
  experiment: 'muted',
  emergency_kill_switch: 'destructive',
};

export default function FlagsList() {
  const dispatch = useDispatch();
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Feature Flags'));
    dispatch(
      adminUiActions.setBreadcrumbs([{ label: 'Feature Flags', path: '/feature-flags' }]),
    );
  }, [dispatch]);

  const flagsQuery = useQuery({
    queryKey: ['feature-flags', { type, query, page: pagination.page }],
    queryFn: () =>
      featureFlagsApi.list({
        type: type === 'all' ? undefined : type,
        q: query || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const flags = flagsQuery.data?.items ?? [];

  useEffect(() => {
    const total = flagsQuery.data?.meta?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [flagsQuery.data?.meta?.total, pagination.setTotal]);

  const columns = [
    {
      key: 'key',
      label: 'Flag',
      render: (row) => (
        <Link
          to={`/feature-flags/${row.id}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.key}
        </Link>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row) => (
        <span className="line-clamp-1 text-xs text-muted-foreground">
          {row.description ?? '—'}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => (
        <Badge variant={TYPE_VARIANTS[row.type] ?? 'muted'}>
          {row.type?.replace(/_/g, ' ') ?? 'release'}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'muted'}>
          {row.status ?? 'inactive'}
        </Badge>
      ),
    },
    {
      key: 'rolloutPercentage',
      label: 'Rollout',
      align: 'right',
      render: (row) =>
        row.rolloutPercentage !== undefined ? `${row.rolloutPercentage}%` : '—',
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.updatedAt ? formatRelativeTime(row.updatedAt) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Feature Flags
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gradual releases, controlled rollouts, and emergency kill switches. Targeting is
            evaluated server-side.
          </p>
        </div>
        <Button asChild>
          <Link to="/feature-flags/new">
            <Plus className="h-4 w-4" /> New flag
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search flags…"
          className="w-full max-w-xs"
        />
        <SegmentedControl options={TYPE_FILTERS} value={type} onChange={setType} />
        <IconButton
          label="Refresh"
          onClick={() => flagsQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw
            className={flagsQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      {flagsQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : flags.length === 0 ? (
        <EmptyState
          icon={ToggleRight}
          title={query || type !== 'all' ? 'No matching flags' : 'No feature flags yet'}
          description={
            query || type !== 'all'
              ? 'Try adjusting your filters.'
              : 'Create a feature flag to control releases gradually.'
          }
          action={
            !query && type === 'all' ? (
              <Button asChild>
                <Link to="/feature-flags/new">Create flag</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={flags} />

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