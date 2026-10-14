import { useState } from 'react';

import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { Alert } from '../../components/ui/Alert.jsx';

export function RestrictionDialog({
  open,
  onOpenChange,
  exchange,
  capabilities = [],
  onSubmit,
  isSubmitting,
}) {
  const [scope, setScope] = useState('adapter');
  const [capabilityKey, setCapabilityKey] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError('Please provide a reason for this restriction');
      return;
    }
    if (scope === 'capability' && !capabilityKey) {
      setError('Please select a capability to restrict');
      return;
    }
    try {
      await onSubmit?.({
        scope,
        capabilityKey: scope === 'capability' ? capabilityKey : undefined,
        reason: reason.trim(),
      });
    } catch (err) {
      setError(err?.message ?? 'Failed to apply restriction');
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
      title="Apply restriction"
      description={exchange ? `Restrict integration: ${exchange.displayName}` : ''}
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
            {isSubmitting ? 'Applying…' : 'Apply restriction'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert variant="warning" title="Scope of the restriction">
          <p className="text-xs">
            Restrictions are applied at the smallest safe scope. A capability restriction does
            not disable unrelated operations on this exchange.
          </p>
        </Alert>

        <div className="flex flex-col gap-1.5">
          <Label>Restriction scope</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={scope === 'adapter' ? 'default' : 'outline'}
              onClick={() => setScope('adapter')}
            >
              Whole adapter
            </Button>
            <Button
              type="button"
              size="sm"
              variant={scope === 'capability' ? 'default' : 'outline'}
              onClick={() => setScope('capability')}
            >
              Specific capability
            </Button>
          </div>
        </div>

        {scope === 'capability' ? (
          <FormField label="Capability" htmlFor="restriction-capability" required>
            <select
              id="restriction-capability"
              value={capabilityKey}
              onChange={(e) => setCapabilityKey(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select capability…</option>
              {capabilities.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label ?? c.key}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}

        <FormField label="Reason" htmlFor="restriction-reason" required>
          <Textarea
            id="restriction-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the operational or security reason for this restriction"
          />
        </FormField>

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}