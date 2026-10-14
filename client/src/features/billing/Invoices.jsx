import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { InvoiceTable } from './components/InvoiceTable.jsx';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Invoices() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Invoices'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Billing', path: ROUTES.app.billing.overview },
        { label: 'Invoices', path: ROUTES.app.billing.invoices },
      ]),
    );
  }, [dispatch]);

  const invoicesQuery = useQuery({
    queryKey: queryKeys.billing.invoices({}),
    queryFn: () => billingApi.listInvoices({}),
  });

  if (invoicesQuery.isLoading) {
    return <LoadingState label="Loading invoices" />;
  }

  if (invoicesQuery.isError) {
    return (
      <ErrorState
        title="Unable to load invoices"
        description="We could not fetch your invoices."
        onRetry={invoicesQuery.refetch}
      />
    );
  }

  const invoices = invoicesQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Immutable invoices issued for each billing period. Corrections create linked
          adjustments instead of rewriting the original.
        </p>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Invoices appear here after your first billing cycle."
        />
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <InvoiceTable invoices={invoices} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}