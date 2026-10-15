import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Building2, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { usePagination } from '../../hooks/usePagination.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatNumber } from '../../lib/formatters/number.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'personal', label: 'Personal' },
  { value: 'organization', label: 'Organization' },
];

const STATUS_VARIANTS = {
  active: 'success',
  suspended: 'destructive',
  archived: 'muted',
  pending: 'warning',
};

export default function WorkspacesList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const pagination = usePagination({ initialPageSize: 25 });

  const workspacesQuery = useQuery({
    queryKey: queryKeys.workspaces.list({
      q: query || undefined,
      type: type === 'all' ? undefined : type,
      page: pagination.page,
      pageSize: pagination.pageSize,
    }),
    queryFn: () =>
      adminApi.listWorkspaces({
        q: query || undefined,
        type: type === 'all' ? undefined : type,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Workspaces'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Workspaces', path: ROUTES.console.workspaces.overview },
      ]),
    );
  }, [dispatch]);

  const workspaces = workspacesQuery.data?.items ?? [];

  useEffect(() => {
    const total = workspacesQuery.data?.meta?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [workspacesQuery.data?.meta?.total, pagination.setTotal]);

  const columns = [
    {
      key: 'name',
      label: 'Workspace',
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {row.name ?? row.id}
            </p>
            <Badge variant={row.type === 'organization' ? 'info' : 'muted'} size="sm">
              {row.type ?? 'personal'}
            </Badge>
          </div>
          <p className="mt-0.5 font-mono text-2xs text-muted-foreground">
            {row.id?.slice(0, 12)}
          </p>
        </div>
      ),
    },
    {
      key: 'owner',
      label: 'Owner',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.ownerName ?? row.ownerEmail ?? '—'}
        </span>
      ),
    },
    {
      key: 'memberCount',
      label: 'Members',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-foreground">
          {formatNumber(row.memberCount ?? 0, { maximumFractionDigits: 0 })}
        </span>
      ),
    },
    {
      key: 'connectionCount',
      label: 'Connections',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-foreground">{row.connectionCount ?? 0}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'muted'}>
          {row.status ?? 'active'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workspaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inspect personal and organization workspaces. Workspace administrators manage
            their own workspaces; this console is for authorized oversight.
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={() => workspacesQuery.refetch()}
          disabled={workspacesQuery.isLoading}
          className="border border-border"
        >
          <RefreshCw
            className={workspacesQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            pagination.goToPage(1);
          }}
          placeholder="Search by name or ID…"
          className="w-full max-w-md"
        />
        <SegmentedControl
          options={TYPE_FILTERS}
          value={type}
          onChange={(v) => {
            setType(v);
            pagination.goToPage(1);
          }}
        />
      </div>

      <Card>
        <CardContent className="p-5 pt-5">
          <DataTable
            columns={columns}
            rows={workspaces}
            isLoading={workspacesQuery.isLoading}
            emptyIcon={Building2}
            emptyTitle={query || type !== 'all' ? 'No matching workspaces' : 'No workspaces'}
            emptyDescription={
              query || type !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Workspaces will appear here as users create them.'
            }
            onRowClick={(row) => {
              if (row.id) navigate(ROUTES.console.workspaces.details(row.id));
            }}
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