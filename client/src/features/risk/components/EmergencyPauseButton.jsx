import { useState } from 'react';
import { AlertOctagon } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Label } from '../../../components/ui/Label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select.jsx';
import { FormField } from '../../../components/forms/FormField.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';

const SCOPES = [
  { value: 'workspace', label: 'Entire workspace' },
  { value: 'sync_group', label: 'Specific sync group' },
  { value: 'destination_account', label: 'Specific destination account' },
  { value: 'exchange', label: 'Exchange adapter' },
  { value: 'instrument', label: 'Instrument category' },
];

export function EmergencyPauseButton({
  onRequestPause,
  isSubmitting,
  scopeOptions,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState('workspace');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError('Please provide a reason for the emergency pause');
      return;
    }
    if (scope !== 'workspace' && !targetId) {
      setError('Please select a target for the pause');
      return;
    }
    try {
      await onRequestPause({
        scope,
        targetId: scope === 'workspace' ? undefined : targetId,
        reason: reason.trim(),
      });
      setOpen(false);
      setReason('');
      setTargetId('');
      setScope('workspace');
    } catch (err) {
      setError(err?.message ?? 'Failed to request emergency pause');
    }
  };

  const targets = scopeOptions?.[scope] ?? [];

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
        className={className}
      >
        <AlertOctagon className="h-4 w-4" /> Emergency pause
      </Button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Request emergency pause"
        description="Stop new eligible live dispatches. Existing exchange orders are not cancelled."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Requesting…' : 'Request pause'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert variant="destructive" title="What emergency pause does">
            <ul className="ml-4 list-disc space-y-1 text-xs">
              <li>Blocks new live dispatches in the selected scope.</li>
              <li>Marks already-submitted operations for tracking or reconciliation.</li>
              <li>Continues to monitor existing orders and positions.</li>
              <li>
                <strong>Does not</strong> automatically cancel exchange orders or close
                positions.
              </li>
            </ul>
          </Alert>

          <FormField label="Scope" htmlFor="pause-scope" required>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger id="pause-scope" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {scope !== 'workspace' ? (
            <FormField label="Target" htmlFor="pause-target" required>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger id="pause-target" className="mt-1.5">
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  {targets.length === 0 ? (
                    <SelectItem value="" disabled>
                      No targets available
                    </SelectItem>
                  ) : (
                    targets.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pause-reason" required>
              Reason
            </Label>
            <Input
              id="pause-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the reason for pausing"
            />
          </div>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}