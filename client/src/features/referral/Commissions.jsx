import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Coins } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { CommissionTable } from './components/CommissionTable.jsx';
import { useCommissions } from '../../hooks/useReferrals.js';
import { usePagination } from '../../hooks/usePagination.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'accumulated', label: 'Accumulated' },
  { value: 'held', label: 'Held' },
  { value: 'payable', label: 'Payable' },
  { value: 'paid', label: 'Paid' },
  { value: 'reversed', label: 'Reversed' },
];

export default function Commissions() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('all');
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Commissions'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Referral', path: ROUTES.app.referral.dashboard },
        { label: 'Commissions', path: ROUTES.app.referral.commissions },
      ]),
    );
  }, [dispatch]);

  const commissionsQuery = useCommissions({
    status: status === 'all' ? undefined : status,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const commissions = commissionsQuery.commissions ?? [];

  if (commissionsQuery.meta?.total !== undefined) {
    pagination.setTotal(commissionsQuery.meta.total);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Commissions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Commission accruals linked to qualifying subscription payments. Each entry is
            traceable to its originating payment and applicable policy version.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={ROUTES.app.referral.ledger}>Open ledger</Link>
        </Button>
      </div>

      <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />

      <Card>
        <CardContent className="p-5 pt-5">
          {commissions.length === 0 && !commissionsQuery.isLoading ? (
            <EmptyState
              icon={Coins}
              title="No commissions"
              description="Commissions appear here as qualifying subscription payments are attributed."
              size="sm"
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <>
              <CommissionTable
                commissions={commissions}
                isLoading={commissionsQuery.isLoading}
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