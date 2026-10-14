import { useState } from 'react';

import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Textarea } from './Textarea.jsx';
import { Label } from './Label.jsx';

export function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  requireReason = false,
  reasonLabel = 'Reason',
  onConfirm,
  isLoading = false,
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    setError(null);

    if (requireReason && !reason.trim()) {
      setError('Please provide a reason for this action');
      return;
    }

    setPending(true);
    try {
      await onConfirm?.({ reason: reason.trim() || undefined });
      onOpenChange?.(false);
      setReason('');
    } catch (err) {
      setError(err?.message ?? 'Failed');
    } finally {
      setPending(false);
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
      title={title}
      description={description}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            disabled={pending || isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            disabled={pending || isLoading}
          >
            {pending || isLoading ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      {requireReason ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-reason" required>
            {reasonLabel}
          </Label>
          <Textarea
            id="confirm-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain the reason for this action"
          />
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}