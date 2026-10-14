import { useState } from 'react';

import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { Alert } from '../../components/ui/Alert.jsx';

export function RolloutForm({ open, onOpenChange, onSubmit, isSubmitting }) {
  const [percentage, setPercentage] = useState('');
  const [targetingNote, setTargetingNote] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setError(null);
    if (percentage === '' || Number(percentage) < 0 || Number(percentage) > 100) {
      setError('Percentage must be between 0 and 100');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for this rollout');
      return;
    }
    try {
      await onSubmit?.({
        percentage: Number(percentage),
        targetingNote: targetingNote.trim() || undefined,
        reason: reason.trim(),
      });
      setPercentage('');
      setTargetingNote('');
      setReason('');
    } catch (err) {
      setError(err?.message ?? 'Rollout failed');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setError(null);
        }
        onOpenChange?.(o);
      }}
      title="Initiate rollout"
      description="Start a staged rollout at a small percentage. Expand gradually."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Starting…' : 'Start rollout'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert variant="info" title="Staged rollout">
          <p className="text-xs">
            Start with a small percentage. Monitor error rates, latency, and module-specific
            health before expanding.
          </p>
        </Alert>

        <FormField label="Percentage" htmlFor="rollout-percentage" required>
          <Input
            id="rollout-percentage"
            type="text"
            inputMode="numeric"
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
            placeholder="5"
          />
        </FormField>

        <FormField
          label="Targeting note"
          htmlFor="rollout-targeting"
          hint="Optional description of the intended cohort."
        >
          <Input
            id="rollout-targeting"
            value={targetingNote}
            onChange={(e) => setTargetingNote(e.target.value)}
          />
        </FormField>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rollout-reason" required>
            Reason
          </Label>
          <Textarea
            id="rollout-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this rollout is starting"
          />
        </div>

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}