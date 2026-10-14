import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';

export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  isLoading,
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    />
  );
}