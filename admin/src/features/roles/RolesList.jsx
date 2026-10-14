import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, ShieldCheck } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { rolesApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

export default function RolesList() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Administrative Roles'));
    dispatch(adminUiActions.setBreadcrumbs([{ label: 'Roles', path: '/roles' }]));
  }, [dispatch]);

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list({ pageSize: 100 }),
  });

  const roles = rolesQuery.data?.items ?? [];

  const columns = [
    {
      key: 'name',
      label: 'Role',
      render: (row) => (
        <Link
          to={`/roles/${row.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {row.name}
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
      key: 'category',
      label: 'Category',
      render: (row) => (
        <Badge variant="muted">
          {row.category?.replace(/_/g, ' ') ?? 'admin'}
        </Badge>
      ),
    },
    {
      key: 'permissionCount',
      label: 'Permissions',
      align: 'right',
      render: (row) => row.permissionCount ?? 0,
    },
    {
      key: 'assignmentCount',
      label: 'Assigned',
      align: 'right',
      render: (row) => row.assignmentCount ?? 0,
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
            Administrative Roles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Granular administrative permissions. The console never uses a single unrestricted
            administrator role.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/roles/new">
              <Plus className="h-4 w-4" /> New role
            </Link>
          </Button>
          <IconButton
            label="Refresh"
            onClick={() => rolesQuery.refetch()}
            className="border border-border"
          >
            <RefreshCw className={rolesQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </IconButton>
        </div>
      </div>

      {rolesQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : roles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No administrative roles defined.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={roles} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}