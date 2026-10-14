import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { FileText, Plus, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { usePagination } from '../../hooks/usePagination.js';
import { referralsApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '../../lib/formatters/date.formatter.js';

const STATUS_VARIANTS = {
  active: 'success',
  draft: 'muted',
  scheduled: 'info',
  retired: 'muted',
  archived: 'muted',
};

export default function Policies() {
  const dispatch = useDispatch();
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Referral Policies'));
    dispatch(
      adminUiActions.setBreadcrumbs([
        { label: 'Referrals', path: '/referrals' },
        { label: 'Policies', path: '/referrals/policies' },
      ]),
    );
  }, [dispatch]);

  const policiesQuery = useQuery({
    queryKey: ['referrals', 'policies', { page: pagination.page }],
    queryFn: () => referralsApi.policies({ page: pagination.page, pageSize: pagination.pageSize }),
  });

  const policies = policiesQuery.data?.items ?? [];

  if (policiesQuery.data?.meta?.total !== undefined) {
    pagination.setTotal(policiesQuery.data.meta.total);
  }

  const columns = [
    {
      key: 'name',
      label: 'Policy',
      render: (row) => (
        <Link
          to={`/referrals/policies/${row.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'version',
      label: 'Version',
      render: (row) => `v${row.version ?? 1}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'muted'}>
          {row.status ?? 'draft'}
        </Badge>
      ),
    },
    {
      key: 'firstPaymentRate',
      label: 'First-payment rate',
      align: 'right',
      render: (row) =>
        row.firstPaymentRate !== undefined
          ? `${(row.firstPaymentRate * 100).toFixed(2)}%`
          : '—',
    },
    {
      key: 'recurringRate',
      label: 'Recurring rate',
      align: 'right',
      render: (row) =>
        row.recurringRate !== undefined
          ? `${(row.recurringRate * 100).toFixed(2)}%`
          : '—',
    },
    {
      key: 'effectiveFrom',
      label: 'Effective',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.effectiveFrom ? formatDate(row.effectiveFrom) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Referral Policies
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Versioned commission policies. New versions apply prospectively — historical
            commissions are never silently recalculated.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/referrals/policies/new">
              <Plus className="h-4 w-4" /> New policy
            </Link>
          </Button>
          <IconButton
            label="Refresh"
            onClick={() => policiesQuery.refetch()}
            className="border border-border"
          >
            <RefreshCw
              className={policiesQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            />
          </IconButton>
        </div>
      </div>

      {policiesQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : policies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No referral policies yet. Create the first policy to enable commissions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={policies} />

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