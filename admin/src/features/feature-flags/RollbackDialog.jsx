import { useState } from 'react';

import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { Alert } from '../../components/ui/Alert.jsx';

export function RollbackDialog({ open, onOpenChange, rollout, onSubmit, isSubmitting }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError('Please provide a reason for the rollback');
      return;
    }
    try {
      await onSubmit?.({ reason: reason.trim() });
      setReason('');
    } catch (err) {
      setError(err?.message ?? 'Rollback failed');
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
      title="Request controlled rollback"
      description={
        rollout
          ? `Rollback rollout started ${rollout.startedAt ?? ''} at ${rollout.percentage ?? 0}%`
          : ''
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting ? 'Requesting…' : 'Request rollback'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert variant="destructive" title="Rollback does not cancel submitted orders">
          <p className="text-xs">
            Rolling back this flag stops the feature for the targeted cohort. Any orders already
            submitted to exchanges remain subject to their own lifecycle and reconciliation.
          </p>
        </Alert>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rollback-reason" required>
            Reason
          </Label>
          <Textarea
            id="rollback-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the operational or safety reason"
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