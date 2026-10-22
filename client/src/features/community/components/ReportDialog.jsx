import { useState } from 'react';

import { Button } from '../../../components/ui/Button.jsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/Dialog.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';

const REASONS = [
  ['spam', 'Spam'],
  ['harassment', 'Harassment'],
  ['impersonation', 'Impersonation'],
  ['fraudulent_claims', 'Fraudulent claims'],
  ['misleading_content', 'Misleading content'],
  ['private_info_disclosure', 'Private information disclosure'],
  ['malicious_links', 'Malicious links'],
  ['copyright', 'Copyright concern'],
  ['other', 'Other'],
];

export function ReportDialog({ open, onOpenChange, onSubmit, submitting = false }) {
  const [reason, setReason] = useState('other');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit?.({ reason, details: details.trim() });
      setReason('other');
      setDetails('');
      onOpenChange(false);
    } catch (err) {
      setError(err?.response?.data?.error?.message || err?.message || 'Report could not be submitted.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Report content</DialogTitle>
            <DialogDescription>
              Reports are reviewed by moderators. Include only relevant details.
            </DialogDescription>
          </DialogHeader>
          <label className="mt-4 flex flex-col gap-1 text-sm">
            Reason
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3"
            >
              {REASONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="mt-3 flex flex-col gap-1 text-sm">
            Details (optional)
            <Textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Describe what concerns you"
            />
          </label>
          {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || saving}>
              {submitting || saving ? 'Submitting…' : 'Submit report'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
