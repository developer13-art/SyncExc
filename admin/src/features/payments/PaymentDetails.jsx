import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { JsonViewer } from '../../components/ui/JsonViewer.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { paymentsApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

const STATUS_VARIANTS = {
  succeeded: 'success',
  pending: 'warning',
  processing: 'warning',
  failed: 'destructive',
  refunded: 'muted',
  partially_refunded: 'warning',
  disputed: 'destructive',
};

export default function PaymentDetails() {
  const { paymentId } = useParams();
  const dispatch = useDispatch();

  const paymentQuery = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => paymentsApi.get(paymentId),
    enabled: Boolean(paymentId),
  });

  const reconciliationQuery = useQuery({
    queryKey: ['payment', paymentId, 'reconciliation'],
    queryFn: () => paymentsApi.reconciliationHistory(paymentId),
    enabled: Boolean(paymentId),
  });

  useEffect(() => {
    if (paymentQuery.data) {
      dispatch(adminUiActions.setPageTitle(`Payment · ${paymentQuery.data.id?.slice(0, 12)}`));
      dispatch(
        adminUiActions.setBreadcrumbs([
          { label: 'Payments', path: '/payments' },
          { label: paymentQuery.data.id?.slice(0, 12) ?? 'Payment', path: `/payments/${paymentId}` },
        ]),
      );
    }
  }, [paymentQuery.data, dispatch, paymentId]);

  if (paymentQuery.isLoading) {
    return <LoadingState label="Loading payment" />;
  }

  if (paymentQuery.error || !paymentQuery.data) {
    return (
      <ErrorState
        title="Unable to load payment"
        description="This payment could not be retrieved."
        onRetry={paymentQuery.refetch}
      />
    );
  }

  const payment = paymentQuery.data;
  const reconciliation = reconciliationQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/payments">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Payment {payment.id?.slice(0, 12)}
          </h1>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">{payment.id}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={STATUS_VARIANTS[payment.internalStatus] ?? 'muted'}>
            Internal: {payment.internalStatus ?? '—'}
          </Badge>
          <Badge variant={STATUS_VARIANTS[payment.providerStatus] ?? 'muted'}>
            Provider: {payment.providerStatus ?? '—'}
          </Badge>
        </div>
      </div>

      {payment.providerStatus !== payment.internalStatus ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
            Provider status and internal processing status differ. Reconciliation may be
            required before any retry.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Payment details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field
            label="Amount"
            value={formatCurrency(payment.amount, payment.currency ?? 'USD')}
          />
          <Field label="Currency" value={payment.currency ?? 'USD'} />
          <Field label="Owner" value={payment.ownerLabel ?? '—'} />
          <Field label="Plan" value={payment.planName ?? '—'} />
          <Field label="Provider" value={payment.provider ?? '—'} />
          <Field
            label="Provider reference"
            value={payment.providerReference ?? '—'}
            mono
          />
          <Field label="Idempotency key" value={payment.idempotencyKey ?? '—'} mono />
          <Field
            label="Created"
            value={payment.createdAt ? formatDateTime(payment.createdAt) : '—'}
          />
          <Field
            label="Paid at"
            value={payment.paidAt ? formatDateTime(payment.paidAt) : '—'}
          />
          <Field
            label="Updated"
            value={payment.updatedAt ? formatDateTime(payment.updatedAt) : '—'}
          />
        </CardContent>
      </Card>

      {payment.linkedRecords ? (
        <Card>
          <CardHeader>
            <CardTitle>Linked records</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {payment.linkedRecords.invoiceId ? (
              <Field
                label="Invoice"
                value={payment.linkedRecords.invoiceId}
                mono
              />
            ) : null}
            {payment.linkedRecords.subscriptionId ? (
              <Field
                label="Subscription"
                value={payment.linkedRecords.subscriptionId}
                mono
              />
            ) : null}
            {payment.linkedRecords.refundIds?.length > 0 ? (
              <Field
                label="Refunds"
                value={`${payment.linkedRecords.refundIds.length} linked`}
              />
            ) : null}
            {payment.linkedRecords.disputeId ? (
              <Field label="Dispute" value={payment.linkedRecords.disputeId} mono />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Reconciliation history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reconciliation.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No reconciliation events recorded.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {reconciliation.map((event, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {event.description ?? event.type}
                    </p>
                    {event.detail ? (
                      <p className="mt-0.5 text-2xs text-muted-foreground">{event.detail}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {event.occurredAt ? formatDateTime(event.occurredAt) : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {payment.rawProviderPayload ? (
        <Card>
          <CardHeader>
            <CardTitle>Provider payload (sanitized)</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonViewer data={payment.rawProviderPayload} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          mono
            ? 'mt-0.5 truncate font-mono text-2xs text-foreground'
            : 'mt-0.5 text-sm font-medium text-foreground'
        }
      >
        {value}
      </p>
    </div>
  );
}