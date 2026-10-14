import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { PaymentTable } from './components/PaymentTable.jsx';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Payments() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Payments'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Billing', path: ROUTES.app.billing.overview },
        { label: 'Payments', path: ROUTES.app.billing.payments },
      ]),
    );
  }, [dispatch]);

  const paymentsQuery = useQuery({
    queryKey: queryKeys.billing.payments({}),
    queryFn: () => billingApi.listPayments({}),
  });

  if (paymentsQuery.isLoading) {
    return <LoadingState label="Loading payments" />;
  }

  if (paymentsQuery.isError) {
    return (
      <ErrorState
        title="Unable to load payments"
        description="We could not fetch your payment history."
        onRetry={paymentsQuery.refetch}
      />
    );
  }

  const payments = paymentsQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Payment history including provider references and processing status.
        </p>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          description="Payment records will appear here after your first charge."
        />
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <PaymentTable payments={payments} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}