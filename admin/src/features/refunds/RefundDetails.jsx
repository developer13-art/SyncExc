import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { RefundApprovalDialog } from './RefundApprovalDialog.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { refundsApi } from '../../api/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

const STATUS_VARIANTS = {
  requested: 'warning',
  under_review: 'warning',
  approved: 'info',
  processing: 'info',
  completed: 'success',
  failed: 'destructive',
  rejected: 'destructive',
  canceled: 'muted',
};

export default function RefundDetails() {
  const { refundId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [decision, setDecision] = useState(null);

  const refundQuery = useQuery({
    queryKey: ['refund', refundId],
    queryFn: () => refundsApi.get(refundId),
    enabled: Boolean(refundId),
  });

  const approveMutation = useMutation({
    mutationFn: (payload) => refundsApi.approve(refundId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refund', refundId] });
      toast.success('Refund approved');
      setDecision(null);
    },
    onError: (err) => {
      toast.error('Approval failed', { description: getErrorMessage(err) });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (payload) => refundsApi.reject(refundId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refund', refundId] });
      toast.success('Refund rejected');
      setDecision(null);
    },
    onError: (err) => {
      toast.error('Rejection failed', { description: getErrorMessage(err) });
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: () => refundsApi.reconcile(refundId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refund', refundId] });
      toast.success('Reconciliation requested');
    },
    onError: (err) => {
      toast.error('Reconciliation failed', { description: getErrorMessage(err) });
    },
  });

  useEffect(() => {
    if (refundQuery.data) {
      dispatch(adminUiActions.setPageTitle(`Refund · ${refundQuery.data.id?.slice(0, 12)}`));
      dispatch(
        adminUiActions.setBreadcrumbs([
          { label: 'Refunds', path: '/refunds' },
          { label: refundQuery.data.id?.slice(0, 12) ?? 'Refund', path: `/refunds/${refundId}` },
        ]),
      );
    }
  }, [refundQuery.data, dispatch, refundId]);

  if (refundQuery.isLoading) {
    return <LoadingState label="Loading refund" />;
  }

  if (refundQuery.error || !refundQuery.data) {
    return (
      <ErrorState
        title="Unable to load refund"
        description="This refund could not be retrieved."
        onRetry={refundQuery.refetch}
      />
    );
  }

  const refund = refundQuery.data;
  const canDecide = ['requested', 'under_review'].includes(refund.status);
  const canReconcile = ['processing', 'failed', 'approved'].includes(refund.status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/refunds">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Refund {refund.id?.slice(0, 12)}
            </h1>
            <Badge variant={STATUS_VARIANTS[refund.status] ?? 'muted'}>
              {refund.status?.replace(/_/g, ' ') ?? 'unknown'}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">{refund.id}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canReconcile ? (
            <Button
              variant="outline"
              onClick={() => reconcileMutation.mutate()}
              disabled={reconcileMutation.isPending}
            >
              <RefreshCw className="h-4 w-4" />
              {reconcileMutation.isPending ? 'Reconciling…' : 'Reconcile'}
            </Button>
          ) : null}
          {canDecide ? (
            <>
              <Button variant="outline" onClick={() => setDecision('reject')}>
                Reject
              </Button>
              <Button onClick={() => setDecision('approve')}>Approve</Button>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Refund details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field
            label="Amount"
            value={formatCurrency(refund.amount, refund.currency ?? 'USD')}
          />
          <Field label="Currency" value={refund.currency ?? 'USD'} />
          <Field
            label="Payment"
            value={refund.paymentId ?? '—'}
            mono
          />
          <Field
            label="Provider reference"
            value={refund.providerRefundReference ?? '—'}
            mono
          />
          <Field label="Requested by" value={refund.requestedBy ?? '—'} />
          <Field
            label="Requested at"
            value={refund.createdAt ? formatDateTime(refund.createdAt) : '—'}
          />
          <Field
            label="Decided at"
            value={refund.decidedAt ? formatDateTime(refund.decidedAt) : '—'}
          />
          <Field
            label="Completed at"
            value={refund.completedAt ? formatDateTime(refund.completedAt) : '—'}
          />
        </CardContent>
      </Card>

      {refund.reason ? (
        <Card>
          <CardHeader>
            <CardTitle>Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{refund.reason}</p>
          </CardContent>
        </Card>
      ) : null}

      {refund.decisionReason ? (
        <Card>
          <CardHeader>
            <CardTitle>Decision reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{refund.decisionReason}</p>
            {refund.decidedBy ? (
              <p className="mt-1 text-2xs text-muted-foreground">by {refund.decidedBy}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {refund.timeline?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {refund.timeline.map((event, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-5 py-3">
                  <p className="text-sm text-foreground">{event.description ?? event.type}</p>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {event.occurredAt ? formatDateTime(event.occurredAt) : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <RefundApprovalDialog
        open={Boolean(decision)}
        onOpenChange={(open) => !open && setDecision(null)}
        decision={decision}
        refund={refund}
        onApprove={(payload) => approveMutation.mutate(payload)}
        onReject={(payload) => rejectMutation.mutate(payload)}
        isSubmitting={approveMutation.isPending || rejectMutation.isPending}
      />
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