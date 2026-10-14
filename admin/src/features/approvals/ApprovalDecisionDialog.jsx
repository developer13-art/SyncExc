import { useState } from 'react';

import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { approvalsApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';
import { useQueryClient } from '@tanstack/react-query';

export function ApprovalDecisionDialog({ open, onOpenChange, decision, approval }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isApprove = decision === 'approve';

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError('Please provide a reason for this decision');
      return;
    }
    setSubmitting(true);
    try {
      if (isApprove) {
        await approvalsApi.approve(approval.id, { reason: reason.trim() });
      } else {
        await approvalsApi.reject(approval.id, { reason: reason.trim() });
      }
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success(`Approval ${isApprove ? 'granted' : 'rejected'}`);
      setReason('');
      onOpenChange?.(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
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
      title={isApprove ? 'Approve action' : 'Reject action'}
      description={
        approval
          ? `${approval.action?.replace(/_/g, ' ')} · requested by ${approval.requesterName ?? approval.requesterId}`
          : ''
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={isApprove ? 'default' : 'destructive'}
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
          >
            {submitting
              ? 'Submitting…'
              : isApprove
                ? 'Confirm approval'
                : 'Confirm rejection'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert variant={isApprove ? 'info' : 'warning'} title={isApprove ? 'Approval' : 'Rejection'}>
          <p className="text-xs">
            {isApprove
              ? 'Approval applies only to the specific parameters reviewed. Material changes invalidate the approval and require re-review.'
              : 'Rejection is recorded with the reason and returned to the requester.'}
          </p>
        </Alert>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="approval-reason" required>
            Reason
          </Label>
          <Textarea
            id="approval-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isApprove ? 'Why this action is approved' : 'Why this action is rejected'}
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