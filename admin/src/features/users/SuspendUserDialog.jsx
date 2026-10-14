import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';

const SCOPE_OPTIONS = [
  {
    value: 'full',
    label: 'Full suspension (block sign-in)',
    description: 'Blocks sign-in entirely. Existing exchange orders are not affected.',
  },
  {
    value: 'selected_actions',
    label: 'Selected actions only',
    description:
      'Restricts specific platform actions but allows sign-in and read-only access.',
  },
  {
    value: 'read_only',
    label: 'Read-only restriction',
    description:
      'Allows sign-in and viewing but blocks all write operations (including trading).',
  },
];

export function SuspendUserDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
  isSubmitting,
}) {
  const [scope, setScope] = useState('full');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setError(null);

    if (!reason.trim()) {
      setError('Please provide a reason for the restriction');
      return;
    }
    if (reason.trim().length < 15) {
      setError('Please provide a meaningful reason (at least 15 characters)');
      return;
    }
    if (duration && Number(duration) <= 0) {
      setError('Duration must be a positive number of hours');
      return;
    }

    try {
      await onConfirm?.({
        scope,
        reason: reason.trim(),
        durationHours: duration ? Number(duration) : undefined,
      });
      setReason('');
      setDuration('');
      setScope('full');
      onOpenChange?.(false);
    } catch (err) {
      setError(err?.message ?? 'Failed to suspend account');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Restrict user account"
      description={
        user
          ? `You are about to apply a restriction to ${user.email ?? user.displayName}.`
          : ''
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Applying…' : 'Apply restriction'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert variant="warning" title="What suspension does and does not do">
          <ul className="ml-4 list-disc space-y-1 text-xs">
            <li>Blocks the selected account actions immediately.</li>
            <li>
              <strong>Does not</strong> cancel exchange orders, close positions, or change
              ownership of assets held by an exchange.
            </li>
            <li>Is fully audited and reported in the platform's audit history.</li>
            <li>Requires a reason and can be reviewed by another authorized administrator.</li>
          </ul>
        </Alert>

        <FormField label="Restriction scope" htmlFor="suspend-scope" required>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger id="suspend-scope" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-2xs text-muted-foreground">
            {SCOPE_OPTIONS.find((o) => o.value === scope)?.description ?? ''}
          </p>
        </FormField>

        <FormField
          label="Duration (hours, optional)"
          htmlFor="suspend-duration"
          hint="Leave blank for an indefinite restriction until explicitly restored."
        >
          <Input
            id="suspend-duration"
            type="text"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 24"
          />
        </FormField>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="suspend-reason" required>
            Reason
          </Label>
          <textarea
            id="suspend-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the reason and any relevant incident/ticket references."
            className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <FormError>{error}</FormError>

        <p className="flex items-start gap-1.5 text-2xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            This action is recorded in the audit history with your identity, the reason, and
            the outcome.
          </span>
        </p>
      </div>
    </Modal>
  );
}