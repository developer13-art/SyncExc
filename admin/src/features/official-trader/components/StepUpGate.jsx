import { StepUpDialog } from '../../auth/components/StepUpDialog.jsx';

export function StepUpGate({ stepUp }) {
  return (
    <StepUpDialog
      open={Boolean(stepUp?.pending)}
      onOpenChange={(open) => {
        if (!open) stepUp.cancel();
      }}
      action={stepUp?.pending}
      onConfirm={stepUp?.confirm}
      error={stepUp?.error}
      submitting={stepUp?.submitting}
    />
  );
}

export default StepUpGate;
