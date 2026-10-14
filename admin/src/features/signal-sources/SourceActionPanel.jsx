import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { signalSourcesApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';

const ACTIONS = [
  {
    key: 'pause',
    label: 'Pause source',
    variant: 'warning',
    description:
      'Stops new eligible ingestion and downstream processing according to the cutoff policy. Does not cancel existing orders or close positions.',
  },
  {
    key: 'suspend',
    label: 'Suspend source',
    variant: 'destructive',
    description:
      'Blocks the source from ingestion and downstream eligibility. Historical records are preserved.',
  },
  {
    key: 'restrict',
    label: 'Restrict capability',
    variant: 'warning',
    description:
      'Reduce the source to a limited scope without fully suspending it.',
  },
  {
    key: 'archive',
    label: 'Archive source',
    variant: 'muted',
    description:
      'Removes the source from active configuration. Historical records retained for audit.',
  },
  {
    key: 'revalidate',
    label: 'Request revalidation',
    variant: 'info',
    description:
      'Queues a fresh connectivity, access, and format check for this source.',
  },
];

export function SourceActionPanel({ sourceId, source }) {
  const toast = useToast();
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const currentAction = ACTIONS.find((a) => a.key === action);

  const handleConfirm = async () => {
    setError(null);
    if (!reason.trim()) {
      setError('Please provide a reason');
      return;
    }
    setSubmitting(true);
    try {
      await signalSourcesApi.lifecycle(sourceId, {
        action,
        reason: reason.trim(),
      });
      toast.success(`Action "${action}" recorded`);
      setAction(null);
      setReason('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <Button
            key={a.key}
            variant={a.variant === 'muted' ? 'outline' : a.variant}
            size="sm"
            onClick={() => setAction(a.key)}
          >
            {a.label}
          </Button>
        ))}
      </CardContent>

      <Modal
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setReason('');
            setError(null);
          }
        }}
        title={currentAction?.label ?? 'Action'}
        description={source?.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setAction(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={currentAction?.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={handleConfirm}
              disabled={submitting || !reason.trim()}
            >
              {submitting ? 'Recording…' : 'Confirm action'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert variant="info" title="Effect of this action">
            <p className="text-xs">{currentAction?.description}</p>
          </Alert>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-action-reason" required>
              Reason
            </Label>
            <Textarea
              id="source-action-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the operational or security reason for this action"
            />
          </div>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </Card>
  );
}