import { useState } from 'react';

import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { ShieldCheck } from 'lucide-react';

export function RestoreUserDialog({ open, onOpenChange, user, onConfirm, isSubmitting }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setError(null);
    if (!reason.trim()) {
      setError('Please provide a reason for restoring access');
      return;
    }
    try {
      await onConfirm?.({ reason: reason.trim() });
      setReason('');
      onOpenChange?.(false);
    } catch (err) {
      setError(err?.message ?? 'Failed to restore account');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Restore account access"
      description={
        user
          ? `Restoring access for ${user.email ?? user.displayName}.`
          : ''
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Restoring…' : 'Restore access'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert variant="info" title="Review before restoring">
          <ul className="ml-4 list-disc space-y-1 text-xs">
            <li>Confirm the reason for the original restriction has been resolved.</li>
            <li>Confirm any security review has been completed.</li>
            <li>The restoration is audited with your identity and reason.</li>
          </ul>
        </Alert>

        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-2xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" />
          <span>
            Full restoration removes active restrictions. Any previously revoked sessions are
            not automatically restored; the user must sign in again.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="restore-reason" required>
            Reason
          </Label>
          <textarea
            id="restore-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why access is being restored."
            className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <FormError>{error}</FormError>
      </div>
    </Modal>
  );
}