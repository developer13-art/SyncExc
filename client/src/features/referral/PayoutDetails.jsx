import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, XCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { PayoutStatusBadge } from '../../components/domain/referral/PayoutStatusBadge.jsx';
import { useQuery, useMutation } from '@tanstack/react-query';
import { referralApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function PayoutDetails() {
  const { payoutId } = useParams();
  const toast = useToast();

  const payoutQuery = useQuery({
    queryKey: queryKeys.referral.payout(payoutId),
    queryFn: () => referralApi.getPayout(payoutId),
    enabled: Boolean(payoutId),
    refetchInterval: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: () => referralApi.cancelPayout(payoutId, { reason: 'User-cancelled' }),
    onSuccess: () => {
      toast.success('Cancellation requested');
      payoutQuery.refetch();
    },
    onError: (err) =>
      toast.error('Cancellation failed', { description: getErrorMessage(err) }),
  });

  if (payoutQuery.isLoading) {
    return <LoadingState label="Loading payout" />;
  }

  if (payoutQuery.error || !payoutQuery.data) {
    return (
      <ErrorState
        title="Unable to load payout"
        description="This payout could not be retrieved."
        onRetry={payoutQuery.refetch}
      />
    );
  }

  const payout = payoutQuery.data;
  const canCancel = ['requested', 'validating', 'pending_review'].includes(payout.status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.referral.payouts}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Payout {payout.id?.slice(0, 12)}
            </h1>
            <PayoutStatusBadge status={payout.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Requested {payout.createdAt ? formatDateTime(payout.createdAt) : '—'}
          </p>
        </div>
        {canCancel ? (
          <Button
            variant="outline"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            <XCircle className="h-4 w-4" />
            {cancelMutation.isPending ? 'Cancelling…' : 'Cancel request'}
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payout summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field
            label="Amount"
            value={formatCurrency(payout.amount, payout.currency ?? 'USD')}
          />
          <Field label="Method" value={payout.methodLabel ?? '—'} />
          <Field label="Destination" value={payout.destinationSummary ?? '—'} />
          <Field label="Fee" value={payout.fee ?? '—'} />
          <Field
            label="Created"
            value={payout.createdAt ? formatDateTime(payout.createdAt) : '—'}
          />
          <Field
            label="Updated"
            value={payout.updatedAt ? formatDateTime(payout.updatedAt) : '—'}
          />
          <Field label="Provider reference" value={payout.providerReference ?? '—'} />
          <Field label="Notes" value={payout.notes ?? '—'} />
        </CardContent>
      </Card>

      {payout.events?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {payout.events.map((event, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {event.title ?? event.type}
                    </p>
                    {event.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {event.occurredAt ? formatDateTime(event.occurredAt) : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}