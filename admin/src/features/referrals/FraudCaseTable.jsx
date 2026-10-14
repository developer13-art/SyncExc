import { useState } from 'react';

import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { referralsApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_VARIANTS = {
  detected: 'warning',
  under_review: 'info',
  additional_information_required: 'warning',
  cleared: 'success',
  confirmed_abuse: 'destructive',
  restricted: 'destructive',
  appealed: 'info',
  closed: 'muted',
};

const DECISIONS = [
  { value: 'cleared', label: 'Clear case' },
  { value: 'confirmed_abuse', label: 'Confirm abuse' },
  { value: 'restricted', label: 'Restrict affiliate' },
  { value: 'request_information', label: 'Request information' },
];

export function FraudCaseTable({ cases = [] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState(null);
  const [decision, setDecision] = useState('cleared');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError('Please provide a reason');
      return;
    }
    setSubmitting(true);
    try {
      await referralsApi.decideFraudCase(target.id, {
        decision,
        reason: reason.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['referrals', 'fraud-cases'] });
      toast.success('Fraud case decision recorded');
      setTarget(null);
      setReason('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'id',
      label: 'Case',
      render: (row) => (
        <span className="font-mono text-xs text-foreground">{row.id?.slice(0, 12)}</span>
      ),
    },
    {
      key: 'affiliateName',
      label: 'Affiliate',
      render: (row) => (
        <span className="text-sm text-foreground">
          {row.affiliateName ?? row.affiliateId}
        </span>
      ),
    },
    {
      key: 'pattern',
      label: 'Pattern',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.pattern?.replace(/_/g, ' ') ?? '—'}
        </span>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (row) => (
        <Badge variant={row.severity === 'high' ? 'destructive' : 'warning'}>
          {row.severity ?? 'medium'}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'muted'}>
          {row.status?.replace(/_/g, ' ') ?? 'detected'}
        </Badge>
      ),
    },
    {
      key: 'detectedAt',
      label: 'Detected',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.detectedAt ? formatDateTime(row.detectedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTarget(row)}
          disabled={row.status === 'closed'}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} rows={cases} />

      <Modal
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setReason('');
            setError(null);
          }
        }}
        title="Record fraud case decision"
        description={target ? `${target.affiliateName ?? target.affiliateId} · ${target.pattern}` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !reason.trim()}>
              {submitting ? 'Recording…' : 'Record decision'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
            Fraud signals are indicators, not proof. Decisions must be based on evidence and
            recorded with a reason. A decision does not silently erase ledger entries.
          </div>

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
            <Label htmlFor="fraud-decision-reason" required>
              Reason
            </Label>
            <Textarea
              id="fraud-decision-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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