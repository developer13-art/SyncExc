import { Badge } from '../../ui/Badge.jsx';

const STATUS_MAP = {
  queued: { label: 'Queued', variant: 'muted' },
  processing: { label: 'Processing', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  completed_with_exceptions: { label: 'With Exceptions', variant: 'warning' },
  partially_completed: { label: 'Partially Complete', variant: 'warning' },
  failed: { label: 'Failed', variant: 'destructive' },
  paused: { label: 'Paused', variant: 'muted' },
  outcome_unknown: { label: 'Unknown', variant: 'destructive' },
  reconciliation_required: { label: 'Reconciliation', variant: 'destructive' },
};

export function OperationStatusBadge({ status, className }) {
  const config = STATUS_MAP[status] ?? { label: status ?? 'Unknown', variant: 'muted' };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}