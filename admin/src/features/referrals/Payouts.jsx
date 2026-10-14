import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Wallet } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { PayoutReviewTable } from './PayoutReviewTable.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { usePagination } from '../../hooks/usePagination.js';
import { referralsApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';

const STATUS_FILTERS = [
  { value: 'pending_review', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
  { value: 'reconciliation_required', label: 'Reconciliation' },
  { value: 'all', label: 'All' },
];

export default function Payouts() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('pending_review');
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Referral Payouts'));
    dispatch(
      adminUiActions.setBreadcrumbs([
        { label: 'Referrals', path: '/referrals' },
        { label: 'Payouts', path: '/referrals/payouts' },
      ]),
    );
  }, [dispatch]);

  const payoutsQuery = useQuery({
    queryKey: ['referrals', 'payouts', { status, page: pagination.page }],
    queryFn: () =>
      referralsApi.payouts({
        status: status === 'all' ? undefined : status,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const payouts = payoutsQuery.data?.items ?? [];

  if (payoutsQuery.data?.meta?.total !== undefined) {
    pagination.setTotal(payoutsQuery.data.meta.total);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Referral Payouts
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and approve payout requests. A payout is not considered paid until the
          provider confirms completion.
        </p>
      </div>

      <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />

      {payoutsQuery.isLoading ? (
        <LoadingState label="Loading payouts" />
      ) : payouts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Wallet className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No payouts match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <PayoutReviewTable payouts={payouts} />

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