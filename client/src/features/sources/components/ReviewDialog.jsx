import { useState } from 'react';

import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { Label } from '../../../components/ui/Label.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';

export function ReviewDialog({
  open,
  onOpenChange,
  decision,
  candidate,
  onSubmit,
  isSubmitting,
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError('Please provide a reason for this decision');
      return;
    }
    try {
      await onSubmit?.({ decision, reason: reason.trim() });
      setReason('');
      onOpenChange?.(false);
    } catch (err) {
      setError(err?.message ?? 'Failed to submit review decision');
    }
  };

  const isApproval = decision === 'approve';

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
      title={isApproval ? 'Approve source candidate' : 'Reject source candidate'}
      description={
        candidate
          ? `Decision for "${candidate.name ?? candidate.proposedName}"`
          : 'Record a review decision'
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={isApproval ? 'default' : 'destructive'}
            onClick={handleSubmit}
            disabled={isSubmitting}
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
        <Alert variant={isApproval ? 'info' : 'warning'} title="Review decision">
          <p className="text-xs">
            {isApproval
              ? 'Approval authorizes the next lifecycle stage — typically validation and connection testing. It does not authorize live trading.'
              : 'Rejection is recorded with the reason. The candidate may be re-submitted later if new evidence is provided.'}
          </p>
        </Alert>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="review-reason" required>
            Reason
          </Label>
          <Textarea
            id="review-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              isApproval
                ? 'Evidence supporting approval'
                : 'Reason for rejection'
            }
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