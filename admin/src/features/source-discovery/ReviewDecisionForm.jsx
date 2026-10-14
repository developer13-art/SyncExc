import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { Alert } from '../../components/ui/Alert.jsx';

const DECISIONS = [
  { value: 'approve', label: 'Approve for validation' },
  { value: 'reject', label: 'Reject' },
  { value: 'request_information', label: 'Request additional information' },
];

export function ReviewDecisionForm({ candidate, onSubmit, isSubmitting }) {
  const [decision, setDecision] = useState('approve');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError('Please provide a reason for this decision');
      return;
    }
    try {
      await onSubmit?.({ decision, reason: reason.trim() });
      setReason('');
    } catch (err) {
      setError(err?.message ?? 'Decision failed');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review decision</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Alert variant="info" title="Scope of this decision">
            <p className="text-xs">
              Approval authorizes the next lifecycle stage (typically validation and connection
              testing). It does not authorize live trading, and does not bypass the platform's
              execution safeguards.
            </p>
          </Alert>

          <div className="flex flex-col gap-1.5">
            <Label>Decision</Label>
            <div className="flex flex-wrap gap-2">
              {DECISIONS.map((d) => (
                <Button
                  key={d.value}
                  type="button"
                  size="sm"
                  variant={decision === d.value ? 'default' : 'outline'}
                  onClick={() => setDecision(d.value)}
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="review-decision-reason" required>
              Reason
            </Label>
            <Textarea
              id="review-decision-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Evidence supporting this decision"
            />
          </div>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || !reason.trim()}>
              {isSubmitting ? 'Recording…' : 'Record decision'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}