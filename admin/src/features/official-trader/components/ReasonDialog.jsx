import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'default',
  reasonLabel = 'Reason',
  minLength = 10,
  isLoading = false,
  onConfirm,
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      variant={variant}
      requireReason
      reasonLabel={reasonLabel}
      isLoading={isLoading}
      onConfirm={async ({ reason }) => {
        const trimmed = (reason ?? '').trim();
        if (trimmed.length < minLength) {
          throw new Error(`A reason of at least ${minLength} characters is required.`);
        }
        await onConfirm(trimmed);
      }}
    />
  );
}

export default ReasonDialog;
