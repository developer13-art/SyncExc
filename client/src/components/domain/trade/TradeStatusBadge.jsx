import { Badge } from '../../ui/Badge.jsx';

const STATUS_MAP = {
  created: { label: 'Created', variant: 'muted' },
  validating: { label: 'Validating', variant: 'warning' },
  awaiting_confirmation: { label: 'Awaiting Confirm', variant: 'warning' },
  submitting: { label: 'Submitting', variant: 'warning' },
  acknowledged: { label: 'Acknowledged', variant: 'info' },
  open: { label: 'Open', variant: 'info' },
  pending: { label: 'Pending', variant: 'warning' },
  partially_filled: { label: 'Partial Fill', variant: 'warning' },
  filled: { label: 'Filled', variant: 'success' },
  closed: { label: 'Closed', variant: 'success' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
  cancelled_confirmed: { label: 'Cancelled', variant: 'muted' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  failed: { label: 'Failed', variant: 'destructive' },
  expired: { label: 'Expired', variant: 'muted' },
  reconciliation_required: { label: 'Reconciliation', variant: 'destructive' },
  outcome_unknown: { label: 'Unknown', variant: 'destructive' },
};

export function TradeStatusBadge({ status, className }) {
  const config = STATUS_MAP[status] ?? { label: status ?? 'Unknown', variant: 'muted' };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}