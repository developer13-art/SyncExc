import { useState } from 'react';

import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';

export function SubscribeDialog({ open, onOpenChange, provider, plan, onConfirm, isSubmitting }) {
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setError(null);
    try {
      await onConfirm?.({ providerId: provider?.id, planId: plan?.id });
      onOpenChange?.(false);
    } catch (err) {
      setError(err?.message ?? 'Subscription failed');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Subscribe to ${provider?.displayName ?? 'provider'}`}
      description={
        plan
          ? `${plan.name} — ${formatCurrency(plan.price, plan.currency ?? 'USD')} / ${plan.billingInterval ?? 'month'}`
          : ''
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Subscribing…' : 'Confirm subscription'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert variant="info" title="What a subscription includes">
          <ul className="ml-4 list-disc space-y-1 text-xs">
            <li>Access to the provider's published signals and content.</li>
            <li>Eligibility to configure copying separately.</li>
            <li>Renewal, cancellation, and refund terms shown at checkout.</li>
          </ul>
        </Alert>

        <Alert variant="warning" title="What a subscription does not do">
          <ul className="ml-4 list-disc space-y-1 text-xs">
            <li>It does not automatically authorize copying.</li>
            <li>It does not grant access to exchange credentials.</li>
            <li>It does not override platform or exchange risk controls.</li>
          </ul>
        </Alert>

        {plan?.features?.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-foreground">Included features</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {plan.features.map((f, i) => (
                <li key={i}>· {f.label ?? f}</li>
              ))}
            </ul>
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