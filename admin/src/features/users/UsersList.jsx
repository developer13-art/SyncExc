import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw, Search, Users } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { usePagination } from '../../hooks/usePagination.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending_verification', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'deletion_pending', label: 'Deletion' },
];

const STATUS_VARIANTS = {
  active: 'success',
  pending_verification: 'warning',
  suspended: 'destructive',
  deletion_pending: 'muted',
  deleted: 'muted',
  temporarily_restricted: 'warning',
};

export default function UsersList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const pagination = usePagination({ initialPageSize: 25 });

  const usersQuery = useQuery({
    queryKey: queryKeys.users.list({
      q: query || undefined,
      status: status === 'all' ? undefined : status,
      page: pagination.page,
      pageSize: pagination.pageSize,
    }),
    queryFn: () =>
      adminApi.listUsers({
        q: query || undefined,
        status: status === 'all' ? undefined : status,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Users'));
    dispatch(
      uiActions.setBreadcrumbs([{ label: 'Users', path: ROUTES.console.users.overview }]),
    );
  }, [dispatch]);

  const users = usersQuery.data?.items ?? [];

  useEffect(() => {
    const total = usersQuery.data?.meta?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [usersQuery.data?.meta?.total, pagination.setTotal]);

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (row) => {
        const initials = (row.displayName ?? row.email ?? '?')
          .split(' ')
          .map((p) => p[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase();

        return (
          <div className="flex items-center gap-3">
            <Avatar size="sm" src={row.avatarUrl} fallback={initials} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {row.displayName ?? '—'}
              </p>
              <p className="truncate text-2xs text-muted-foreground">{row.email ?? ''}</p>
            </div>
          </div>
        );
      },
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
      key: 'emailVerification',
      label: 'Email',
      render: (row) =>
        row.emailVerifiedAt ? (
          <Badge variant="success" size="sm">
            Verified
          </Badge>
        ) : (
          <Badge variant="warning" size="sm">
            Unverified
          </Badge>
        ),
    },
    {
      key: 'mfa',
      label: 'MFA',
      render: (row) =>
        row.mfaEnabled ? (
          <Badge variant="success" size="sm">
            Enabled
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: 'workspaceCount',
      label: 'Workspaces',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-foreground">{row.workspaceCount ?? 0}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Registered',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatRelativeTime(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'lastActivityAt',
      label: 'Last activity',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.lastActivityAt ? formatRelativeTime(row.lastActivityAt) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search and inspect user accounts. Sensitive fields are masked by default. Passwords,
            MFA secrets, recovery codes, session tokens, and exchange API secrets are never
            displayed.
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={() => usersQuery.refetch()}
          disabled={usersQuery.isLoading}
          className="border border-border"
        >
          <RefreshCw className={usersQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            pagination.goToPage(1);
          }}
          placeholder="Search by email, name, or user ID…"
          className="w-full max-w-md"
        />
        <SegmentedControl
          options={STATUS_FILTERS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            pagination.goToPage(1);
          }}
        />
      </div>

      <Card>
        <CardContent className="p-5 pt-5">
          <DataTable
            columns={columns}
            rows={users}
            rowKey={(row) => row.id ?? row.userId ?? row.user_id ?? row.email}
            isLoading={usersQuery.isLoading}
            emptyIcon={Users}
            emptyTitle={query || status !== 'all' ? 'No matching users' : 'No users yet'}
            emptyDescription={
              query || status !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Registered users will appear here.'
            }
            onRowClick={(row) => {
              const userId = row.id ?? row.userId ?? row.user_id;
              if (!userId) {
                console.error('Cannot open admin user record without an ID.', row);
                return;
              }
              navigate(ROUTES.console.users.details(userId));
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

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          Search is scoped to your permissions and rate-limited to prevent account enumeration.
          Access to a user record is recorded as an administrative audit event.
        </CardContent>
      </Card>
    </div>
  );
}