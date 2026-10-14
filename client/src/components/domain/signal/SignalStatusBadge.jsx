import { Badge } from '../../ui/Badge.jsx';

const STATUS_MAP = {
  draft: { label: 'Draft', variant: 'muted' },
  pending_validation: { label: 'Validating', variant: 'warning' },
  pending_review: { label: 'Review', variant: 'warning' },
  review_required: { label: 'Review Required', variant: 'warning' },
  published: { label: 'Published', variant: 'info' },
  updated: { label: 'Updated', variant: 'info' },
  eligible: { label: 'Eligible', variant: 'success' },
  approved: { label: 'Approved', variant: 'success' },
  executed: { label: 'Executed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  expired: { label: 'Expired', variant: 'destructive' },
  closed: { label: 'Closed', variant: 'muted' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  withdrawn: { label: 'Withdrawn', variant: 'muted' },
  blocked_duplicate: { label: 'Duplicate', variant: 'destructive' },
  blocked_source: { label: 'Source Blocked', variant: 'destructive' },
};

export function SignalStatusBadge({ status, className }) {
  const config = STATUS_MAP[status] ?? { label: status ?? 'Unknown', variant: 'muted' };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}