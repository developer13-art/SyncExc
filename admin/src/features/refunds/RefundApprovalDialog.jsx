import { useState } from 'react';

import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';

export function RefundApprovalDialog({
  open,
  onOpenChange,
  decision,
  refund,
  onApprove,
  onReject,
  isSubmitting,
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  const isApproval = decision === 'approve';

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError('Please provide a reason for this decision');
      return;
    }
    try {
      if (isApproval) {
        await onApprove?.({ reason: reason.trim() });
      } else {
        await onReject?.({ reason: reason.trim() });
      }
    } catch (err) {
      setError(err?.message ?? 'Decision failed');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReason('');
          setError(null);
        }
        onOpenChange?.(o);
      }}
      title={isApproval ? 'Approve refund' : 'Reject refund'}
      description={
        refund
          ? `${formatCurrency(refund.amount, refund.currency ?? 'USD')} · payment ${refund.paymentId?.slice(0, 12)}`
          : ''
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={isApproval ? 'default' : 'destructive'}
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting
              ? 'Submitting…'
              : isApproval
                ? 'Confirm approval'
                : 'Confirm rejection'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert variant={isApproval ? 'info' : 'warning'} title={isApproval ? 'Approval' : 'Rejection'}>
          <ul className="ml-4 list-disc space-y-1 text-xs">
            {isApproval ? (
              <>
                <li>
                  Approval routes the refund to the provider. Completion is confirmed only when
                  the provider returns a final result.
                </li>
                <li>
                  Duplicate-refund prevention is enforced; cumulative refunds cannot exceed the
                  eligible amount.
                </li>
                <li>High-value refunds may require a second authorized approver.</li>
              </>
            ) : (
              <>
                <li>
                  Rejection is recorded with the reason and returned to the requester.
                </li>
                <li>The refund can be requested again if the situation changes.</li>
              </>
            )}
          </ul>
        </Alert>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="refund-decision-reason" required>
            Reason
          </Label>
          <Textarea
            id="refund-decision-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isApproval ? 'Evidence and policy basis for approval' : 'Reason for rejection'}
          />
        </div>

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}