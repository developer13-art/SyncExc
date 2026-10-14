import { useState } from 'react';

import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';

export function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  isLoading = false,
}) {
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm?.();
      onOpenChange?.(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={pending || isLoading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={handleConfirm} disabled={pending || isLoading}>
            {pending || isLoading ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    />
  );
}