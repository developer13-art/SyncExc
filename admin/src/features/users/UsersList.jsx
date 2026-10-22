import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, BadgeCheck, RefreshCw, ShieldCheck, Users } from 'lucide-react';

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
  const activeOnPage = users.filter((user) => user.status === 'active').length;
  const mfaOnPage = users.filter((user) => user.mfaEnabled).length;

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
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/10">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Platform directory
                </p>
                <Badge variant="muted" size="sm">Identity & access</Badge>
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Users</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Review account status, verification, and security posture across the platform.
              </p>
            </div>
          </div>
          <IconButton
            label="Refresh users"
            onClick={() => usersQuery.refetch()}
            disabled={usersQuery.isLoading}
            className="border border-border bg-background/70"
          >
            <RefreshCw className={usersQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </IconButton>
        </div>
        <div className="grid border-t border-border/70 bg-background/30 sm:grid-cols-3">
          <div className="border-b border-border/70 p-4 sm:border-b-0 sm:border-r">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Matching accounts
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {pagination.total.toLocaleString()}
            </p>
          </div>
          <div className="border-b border-border/70 p-4 sm:border-b-0 sm:border-r">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-success" />
              Active on this page
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-success">
              {activeOnPage.toLocaleString()}
            </p>
          </div>
          <div className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              MFA enabled on this page
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {mfaOnPage.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / {users.length}
              </span>
            </p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Account directory</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {usersQuery.isFetching
                  ? 'Refreshing account data…'
                  : `Showing ${users.length.toLocaleString()} of ${pagination.total.toLocaleString()} matching accounts`}
              </p>
            </div>
            <Badge variant="info" size="sm">
              <BadgeCheck className="mr-1 h-3 w-3" />
              Audited access
            </Badge>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                pagination.goToPage(1);
              }}
              placeholder="Search by email, name, or user ID…"
              className="w-full xl:max-w-md"
            />
            <div className="overflow-x-auto">
              <SegmentedControl
                options={STATUS_FILTERS}
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  pagination.goToPage(1);
                }}
              />
            </div>
          </div>
        </div>
        <CardContent className="p-4">
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