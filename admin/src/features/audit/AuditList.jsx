import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { AuditSearch } from './AuditSearch.jsx';
import { usePagination } from '../../hooks/usePagination.js';
import { auditApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

const OUTCOME_VARIANTS = {
  success: 'success',
  failure: 'destructive',
  blocked: 'destructive',
  denied: 'warning',
  pending: 'warning',
};

const ACTIONS = [
  'admin.suspend_user',
  'admin.restore_user',
  'admin.revoke_sessions',
  'admin.create_plan',
  'admin.publish_plan',
  'admin.apply_refund',
  'admin.restrict_exchange',
  'admin.publish_policy',
  'admin.approve_payout',
  'admin.create_role',
  'admin.update_role',
  'admin.publish_feature_flag',
  'admin.rollback_feature_flag',
];

const MODULES = [
  'identity',
  'billing',
  'workspaces',
  'connections',
  'terminal',
  'synchronization',
  'risk',
  'sources',
  'signals',
  'marketplace',
  'automation',
  'simulation',
  'referral',
  'developer',
  'community',
  'notifications',
  'support',
  'admin',
];

export function AuditList() {
  const pagination = usePagination({ initialPageSize: 50 });
  const [filters, setFilters] = useState({});

  const auditQuery = useQuery({
    queryKey: ['audit', { ...filters, page: pagination.page }],
    queryFn: () =>
      auditApi.list({
        ...filters,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const events = auditQuery.data?.items ?? [];

  useEffect(() => {
    const total = auditQuery.data?.meta?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [auditQuery.data?.meta?.total, pagination.setTotal]);

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
      key: 'actorName',
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
        <Link
          to={`/audit/${row.id}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          {row.action?.replace(/_/g, ' ') ?? '—'}
        </Link>
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
      key: 'module',
      label: 'Module',
      render: (row) => <Badge variant="muted">{row.module ?? '—'}</Badge>,
    },
    {
      key: 'outcome',
      label: 'Outcome',
      render: (row) => (
        <Badge variant={OUTCOME_VARIANTS[row.outcome] ?? 'muted'}>
          {row.outcome ?? 'recorded'}
        </Badge>
      ),
    },
  ];

  return (
    <Card>
      <CardContent className="p-5 pt-5">
        <AuditSearch
          filters={filters}
          onFiltersChange={setFilters}
          onReset={() => setFilters({})}
          actions={ACTIONS}
          modules={MODULES}
        />

        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {auditQuery.data?.meta?.total !== undefined
              ? `${auditQuery.data.meta.total} events`
              : ''}
          </p>
          <IconButton
            label="Refresh"
            onClick={() => auditQuery.refetch()}
            className="border border-border"
          >
            <RefreshCw
              className={auditQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            />
          </IconButton>
        </div>

        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={events}
            isLoading={auditQuery.isLoading}
            emptyTitle="No audit events"
            emptyDescription="Try adjusting your filters or date range."
          />
        </div>

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
  );
}