import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';

export function UpgradeDialog({
  open,
  onOpenChange,
  currentPlan,
  targetPlan,
  onConfirm,
  isSubmitting,
}) {
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setError(null);
    try {
      await onConfirm?.({ planId: targetPlan?.id });
      onOpenChange?.(false);
    } catch (err) {
      setError(err?.message ?? 'Plan change failed');
    }
  };

  const isUpgrade =
    currentPlan && targetPlan
      ? Number(targetPlan.price) > Number(currentPlan.price)
      : true;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isUpgrade ? 'Upgrade plan' : 'Downgrade plan'}
      description={
        currentPlan && targetPlan
          ? `${currentPlan.name} → ${targetPlan.name}`
          : ''
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Processing…' : isUpgrade ? 'Confirm upgrade' : 'Confirm downgrade'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert variant={isUpgrade ? 'info' : 'warning'} title={isUpgrade ? 'Upgrade' : 'Downgrade'}>
          <ul className="ml-4 list-disc space-y-1 text-xs">
            {isUpgrade ? (
              <>
                <li>The new plan takes effect at the time stated at checkout.</li>
                <li>Any immediate charge or prorated amount is shown before confirmation.</li>
                <li>Entitlements update at the defined effective time.</li>
              </>
            ) : (
              <>
                <li>The downgrade takes effect at the end of the current period unless stated otherwise.</li>
                <li>Features or limits that change are displayed before you confirm.</li>
                <li>
                  Existing records and configurations are preserved — exceeding the new plan's
                  limits does not delete your data.
                </li>
              </>
            )}
          </ul>
        </Alert>

        {targetPlan ? (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">New plan</span>
              <span className="font-medium text-foreground">{targetPlan.name}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Price</span>
              <span className="font-medium text-foreground">
                {formatCurrency(targetPlan.price, targetPlan.currency, { showSymbol: true })}
                /{targetPlan.billingInterval ?? 'month'}
              </span>
            </div>
            {targetPlan.prorationAmount !== undefined ? (
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Proration</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(targetPlan.prorationAmount, targetPlan.currency)}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}