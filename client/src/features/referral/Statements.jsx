import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Download, FileText } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useQuery } from '@tanstack/react-query';
import { referralApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { usePagination } from '../../hooks/usePagination.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDate } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Statements() {
  const dispatch = useDispatch();
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Commission Statements'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Referral', path: ROUTES.app.referral.dashboard },
        { label: 'Statements', path: ROUTES.app.referral.statements },
      ]),
    );
  }, [dispatch]);

  const statementsQuery = useQuery({
    queryKey: queryKeys.referral.statements({
      page: pagination.page,
      pageSize: pagination.pageSize,
    }),
    queryFn: () =>
      referralApi.listStatements({
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const statements = statementsQuery.data?.items ?? [];

  if (statementsQuery.data?.meta?.total !== undefined) {
    pagination.setTotal(statementsQuery.data.meta.total);
  }

  const columns = [
    {
      key: 'periodStart',
      label: 'Period',
      render: (row) => (
        <span className="text-xs text-foreground">
          {row.periodStart ? formatDate(row.periodStart) : '—'} –{' '}
          {row.periodEnd ? formatDate(row.periodEnd) : '—'}
        </span>
      ),
    },
    {
      key: 'totalAccrued',
      label: 'Accrued',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-foreground">
          {formatCurrency(row.totalAccrued ?? 0, row.currency ?? 'USD')}
        </span>
      ),
    },
    {
      key: 'totalPaid',
      label: 'Paid',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatCurrency(row.totalPaid ?? 0, row.currency ?? 'USD')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <a
          href={`/api/v1/affiliate/statements/${row.id}/download`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Download className="h-3 w-3" /> Download
        </a>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Commission Statements
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Periodic statements of accrued and paid commissions. Statements are immutable once
          issued.
        </p>
      </div>

      {statementsQuery.isLoading ? (
        <LoadingState label="Loading statements" />
      ) : statementsQuery.isError ? (
        <ErrorState
          title="Unable to load statements"
          description="We could not fetch your statements."
          onRetry={statementsQuery.refetch}
        />
      ) : statements.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No statements yet"
          description="Statements appear here at the end of each eligible period."
        />
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={statements} />
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