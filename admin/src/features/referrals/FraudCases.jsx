import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { ShieldAlert } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { FraudCaseTable } from './FraudCaseTable.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { usePagination } from '../../hooks/usePagination.js';
import { referralsApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';

const STATUS_FILTERS = [
  { value: 'detected', label: 'Detected' },
  { value: 'under_review', label: 'Under review' },
  { value: 'additional_information_required', label: 'Info required' },
  { value: 'confirmed_abuse', label: 'Confirmed abuse' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'all', label: 'All' },
];

export default function FraudCases() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('detected');
  const pagination = usePagination({ initialPageSize: 25 });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Fraud Cases'));
    dispatch(
      adminUiActions.setBreadcrumbs([
        { label: 'Referrals', path: '/referrals' },
        { label: 'Fraud cases', path: '/referrals/fraud-cases' },
      ]),
    );
  }, [dispatch]);

  const fraudCasesQuery = useQuery({
    queryKey: ['referrals', 'fraud-cases', { status, page: pagination.page }],
    queryFn: () =>
      referralsApi.fraudCases({
        status: status === 'all' ? undefined : status,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const cases = fraudCasesQuery.data?.items ?? [];

  useEffect(() => {
    const total = fraudCasesQuery.data?.meta?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [fraudCasesQuery.data?.meta?.total, pagination.setTotal]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Fraud Cases
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suspicious referral activity under review. A single weak signal — such as shared
          network access — is not treated as proof of abuse.
        </p>
      </div>

      <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />

      {fraudCasesQuery.isLoading ? (
        <LoadingState label="Loading fraud cases" />
      ) : cases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No fraud cases match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <FraudCaseTable cases={cases} />

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