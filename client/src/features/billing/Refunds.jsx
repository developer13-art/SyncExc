import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { useQuery, useMutation } from '@tanstack/react-query';
import { billingApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

const REFUND_VARIANTS = {
  requested: 'warning',
  under_review: 'warning',
  approved: 'info',
  processing: 'info',
  completed: 'success',
  rejected: 'destructive',
  failed: 'destructive',
  canceled: 'muted',
};

export default function Refunds() {
  const dispatch = useDispatch();
  const toast = useToast();

  const [requestOpen, setRequestOpen] = useState(false);
  const [form, setForm] = useState({ paymentId: '', amount: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Refunds'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Billing', path: ROUTES.app.billing.overview },
        { label: 'Refunds', path: ROUTES.app.billing.refunds },
      ]),
    );
  }, [dispatch]);

  const refundsQuery = useQuery({
    queryKey: queryKeys.billing.refunds({}),
    queryFn: () => billingApi.listRefundRequests({}),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => billingApi.submitRefundRequest(payload),
    onSuccess: () => {
      toast.success('Refund request submitted', {
        description: 'A team member will review it shortly.',
      });
      setRequestOpen(false);
      setForm({ paymentId: '', amount: '', reason: '' });
      refundsQuery.refetch();
    },
    onError: (err) =>
      toast.error('Request failed', { description: getErrorMessage(err) }),
  });

  const refunds = refundsQuery.data?.items ?? [];

  const handleSubmit = () => {
    if (!form.paymentId.trim()) {
      toast.error('Payment ID is required');
      return;
    }
    if (!form.reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    setSubmitting(true);
    createMutation.mutate(
      {
        paymentId: form.paymentId.trim(),
        amount: form.amount || undefined,
        reason: form.reason.trim(),
      },
      { onSettled: () => setSubmitting(false) },
    );
  };

  const columns = [
    {
      key: 'createdAt',
      label: 'Requested',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatRelativeTime(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'paymentReference',
      label: 'Payment',
      render: (row) => (
        <span className="font-mono text-xs text-foreground">
          {row.paymentReference ?? row.paymentId?.slice(0, 12) ?? '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-foreground">
          {formatCurrency(row.amount ?? 0, row.currency ?? 'USD')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={REFUND_VARIANTS[row.status] ?? 'muted'}>
          {row.status?.replace(/_/g, ' ') ?? 'requested'}
        </Badge>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.reason ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Refunds</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Refund requests and outcomes. Approval and completion are distinct states.
          </p>
        </div>
        <Button onClick={() => setRequestOpen(true)}>
          <Plus className="h-4 w-4" /> Request refund
        </Button>
      </div>

      {refundsQuery.isLoading ? (
        <LoadingState label="Loading refunds" />
      ) : refundsQuery.isError ? (
        <ErrorState
          title="Unable to load refunds"
          description="We could not fetch your refund requests."
          onRetry={refundsQuery.refetch}
        />
      ) : refunds.length === 0 ? (
        <EmptyState
          title="No refund requests"
          description="Refunds you request will appear here with their current status."
        />
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={refunds} />
          </CardContent>
        </Card>
      )}

      <Modal
        open={requestOpen}
        onOpenChange={setRequestOpen}
        title="Request a refund"
        description="Provide the payment ID and reason. Refunds are reviewed against the applicable policy."
        footer={
          <>
            <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Payment ID" htmlFor="refund-payment" required>
            <Input
              id="refund-payment"
              value={form.paymentId}
              onChange={(e) => setForm({ ...form, paymentId: e.target.value })}
              placeholder="pay_..."
            />
          </FormField>
          <FormField
            label="Amount"
            htmlFor="refund-amount"
            hint="Leave blank for a full refund."
          >
            <Input
              id="refund-amount"
              type="text"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Optional"
            />
          </FormField>
          <FormField label="Reason" htmlFor="refund-reason" required>
            <Textarea
              id="refund-reason"
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}