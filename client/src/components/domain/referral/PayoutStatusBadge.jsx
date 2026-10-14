import { Badge } from '../../ui/Badge.jsx';

const STATUS_MAP = {
  requested: { label: 'Requested', variant: 'info' },
  validating: { label: 'Validating', variant: 'warning' },
  pending_review: { label: 'Review', variant: 'warning' },
  approved: { label: 'Approved', variant: 'info' },
  processing: { label: 'Processing', variant: 'warning' },
  paid: { label: 'Paid', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
  returned: { label: 'Returned', variant: 'destructive' },
  reconciliation_required: { label: 'Reconciliation', variant: 'destructive' },
};

export function PayoutStatusBadge({ status, className }) {
  const config = STATUS_MAP[status] ?? { label: status ?? 'Unknown', variant: 'muted' };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}