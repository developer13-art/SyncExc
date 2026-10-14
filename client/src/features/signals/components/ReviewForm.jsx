import { useState } from 'react';

import { Button } from '../../../components/ui/Button.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { Label } from '../../../components/ui/Label.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card.jsx';

export function ReviewForm({ signal, onSubmit, isSubmitting, className }) {
  const [decision, setDecision] = useState('confirm');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError('Please provide a reason for this review decision');
      return;
    }

    try {
      await onSubmit?.({ decision, reason: reason.trim() });
      setReason('');
    } catch (err) {
      setError(err?.message ?? 'Failed to submit review');
    }
  };

  if (!signal) {
    return null;
  }

  const issues = signal.issues ?? [];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Review decision</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {issues.length > 0 ? (
            <Alert variant="warning" title={`${issues.length} unresolved issue(s)`}>
              <ul className="ml-4 list-disc space-y-1 text-xs">
                {issues.map((issue, i) => (
                  <li key={i}>{issue.label ?? issue.type}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label>Decision</Label>
            <div className="flex gap-2">
              {[
                { value: 'confirm', label: 'Confirm' },
                { value: 'correct', label: 'Correct' },
                { value: 'reject', label: 'Reject' },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={decision === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDecision(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="review-reason" required>
              Reason
            </Label>
            <Textarea
              id="review-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain your decision. Corrections require traceable justification."
            />
          </div>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Submit review'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}