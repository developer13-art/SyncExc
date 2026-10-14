import { useState } from 'react';
import { Check, X } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { referralsApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_VARIANTS = {
  requested: 'info',
  pending_review: 'warning',
  approved: 'info',
  processing: 'info',
  paid: 'success',
  failed: 'destructive',
  rejected: 'destructive',
  reconciliation_required: 'destructive',
};

export function PayoutReviewTable({ payouts = [] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError('Please provide a reason');
      return;
    }
    setSubmitting(true);
    try {
      if (action.action === 'approve') {
        await referralsApi.approvePayout(action.payout.id, { reason: reason.trim() });
      } else {
        await referralsApi.rejectPayout(action.payout.id, { reason: reason.trim() });
      }
      queryClient.invalidateQueries({ queryKey: ['referrals', 'payouts'] });
      toast.success(`Payout ${action.action === 'approve' ? 'approved' : 'rejected'}`);
      setAction(null);
      setReason('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'id',
      label: 'Payout',
      render: (row) => (
        <span className="font-mono text-xs text-foreground">{row.id?.slice(0, 12)}</span>
      ),
    },
    {
      key: 'affiliate',
      label: 'Affiliate',
      render: (row) => (
        <span className="text-sm text-foreground">{row.affiliateName ?? row.affiliateId}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-foreground">
          {formatCurrency(row.amount, row.currency ?? 'USD')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'muted'}>
          {row.status?.replace(/_/g, ' ') ?? 'unknown'}
        </Badge>
      ),
    },
    {
      key: 'requestedAt',
      label: 'Requested',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.requestedAt ? formatDateTime(row.requestedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          {row.status === 'pending_review' || row.status === 'requested' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setAction({ action: 'reject', payout: row })}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAction({ action: 'approve', payout: row })}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} rows={payouts} />

      <Modal
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setReason('');
            setError(null);
          }
        }}
        title={action?.action === 'approve' ? 'Approve payout' : 'Reject payout'}
        description={
          action
            ? `${formatCurrency(action.payout.amount, action.payout.currency ?? 'USD')} · ${action.payout.affiliateName ?? action.payout.affiliateId}`
            : ''
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setAction(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant={action?.action === 'approve' ? 'default' : 'destructive'}
              onClick={handleSubmit}
              disabled={submitting || !reason.trim()}
            >
              {submitting
                ? 'Submitting…'
                : action?.action === 'approve'
                  ? 'Confirm approval'
                  : 'Confirm rejection'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            {action?.action === 'approve'
              ? 'Approval routes the payout to the provider. Paid state requires provider confirmation.'
              : 'Rejection returns the amount to the affiliate\'s payable balance.'}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payout-decision-reason" required>
              Reason
            </Label>
            <Textarea
              id="payout-decision-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}