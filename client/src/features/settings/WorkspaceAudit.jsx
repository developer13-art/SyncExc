import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { useQuery } from '@tanstack/react-query';
import { workspacesApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { usePagination } from '../../hooks/usePagination.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function WorkspaceAudit() {
  const { workspaceId } = useParams();
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');
  const pagination = usePagination({ initialPageSize: 50 });

  const auditQuery = useQuery({
    queryKey: queryKeys.workspaces.audit(workspaceId, {
      q: query || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    }),
    queryFn: () =>
      workspacesApi.getAuditEvents(workspaceId, {
        q: query || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Audit History'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Settings', path: ROUTES.app.settings.profile },
        { label: 'Workspaces', path: ROUTES.app.settings.workspaces },
        {
          label: 'Audit history',
          path: ROUTES.app.settings.workspaceAudit(workspaceId),
        },
      ]),
    );
  }, [dispatch, workspaceId]);

  const events = auditQuery.data?.items ?? [];

  if (auditQuery.data?.meta?.total !== undefined) {
    pagination.setTotal(auditQuery.data.meta.total);
  }

  const columns = [
    {
      key: 'occurredAt',
      label: 'Time',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.occurredAt ? formatDateTime(row.occurredAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actor',
      label: 'Actor',
      render: (row) => (
        <span className="text-sm text-foreground">
          {row.actorName ?? row.actorId ?? '—'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <span className="text-xs font-medium text-foreground">
          {row.action?.replace(/_/g, ' ') ?? '—'}
        </span>
      ),
    },
    {
      key: 'target',
      label: 'Target',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.targetType ? `${row.targetType}: ` : ''}
          {row.targetId?.slice(0, 12) ?? '—'}
        </span>
      ),
    },
    {
      key: 'outcome',
      label: 'Outcome',
      render: (row) => (
        <Badge variant={row.outcome === 'success' ? 'success' : 'warning'}>
          {row.outcome ?? 'recorded'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.settings.workspace(workspaceId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Audit History
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Append-only audit of security-sensitive workspace events. Records are retained per
          retention policy and cannot be edited by workspace administrators.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search audit events…"
          className="w-full max-w-xs"
        />
        <IconButton
          label="Refresh"
          onClick={() => auditQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw className={auditQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
      </div>

      <Card>
        <CardContent className="p-5 pt-5">
          <DataTable
            columns={columns}
            rows={events}
            isLoading={auditQuery.isLoading}
            emptyTitle="No audit events"
            emptyDescription="Security-sensitive workspace events will appear here."
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