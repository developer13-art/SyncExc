import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { useLedger } from '../../hooks/useReferrals.js';
import { usePagination } from '../../hooks/usePagination.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export function Ledger() {
  const dispatch = useDispatch();
  const [type, setType] = useState('all');
  const pagination = usePagination({ initialPageSize: 50 });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Commission Ledger'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Referral', path: ROUTES.app.referral.dashboard },
        { label: 'Ledger', path: ROUTES.app.referral.ledger },
      ]),
    );
  }, [dispatch]);

  const ledgerQuery = useLedger({
    type: type === 'all' ? undefined : type,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const entries = ledgerQuery.entries ?? [];

  if (ledgerQuery.meta?.total !== undefined) {
    pagination.setTotal(ledgerQuery.meta.total);
  }

  const columns = [
    {
      key: 'createdAt',
      label: 'Date',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatDateTime(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Entry type',
      render: (row) => (
        <Badge variant={ledgerVariant(row.type)}>
          {row.type?.replace(/_/g, ' ') ?? '—'}
        </Badge>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row) => (
        <span className="text-xs text-foreground">{row.description ?? '—'}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (row) => (
        <span
          className={
            Number(row.amount) < 0
              ? 'font-medium text-destructive'
              : 'font-medium text-foreground'
          }
        >
          {Number(row.amount) > 0 ? '+' : ''}
          {formatCurrency(row.amount ?? 0, row.currency ?? 'USD')}
        </span>
      ),
    },
    {
      key: 'balanceAfter',
      label: 'Balance after',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.balanceAfter !== undefined
            ? formatCurrency(row.balanceAfter, row.currency ?? 'USD')
            : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Commission Ledger
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Append-only ledger of commission accruals, holds, releases, adjustments, and
            reversals. Corrections create new entries — the original is preserved.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={ROUTES.app.referral.statements}>View statements</Link>
        </Button>
      </div>

      <SegmentedControl
        options={[
          { value: 'all', label: 'All' },
          { value: 'accrual', label: 'Accruals' },
          { value: 'hold', label: 'Holds' },
          { value: 'release', label: 'Releases' },
          { value: 'adjustment', label: 'Adjustments' },
          { value: 'reversal', label: 'Reversals' },
          { value: 'payout', label: 'Payouts' },
        ]}
        value={type}
        onChange={setType}
      />

      <Card>
        <CardContent className="p-5 pt-5">
          {entries.length === 0 && !ledgerQuery.isLoading ? (
            <EmptyState
              title="No ledger entries"
              description="Entries appear here as commissions and adjustments are recorded."
              size="sm"
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={entries}
                isLoading={ledgerQuery.isLoading}
                emptyTitle="No entries"
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ledgerVariant(type) {
  if (type === 'accrual') {
    return 'info';
  }
  if (type === 'release' || type === 'payout') {
    return 'success';
  }
  if (type === 'reversal') {
    return 'destructive';
  }
  if (type === 'hold' || type === 'adjustment') {
    return 'warning';
  }
  return 'muted';
}

export default Ledger;