import { Badge } from '../../ui/Badge.jsx';

const STATUS_MAP = {
  queued: { label: 'Queued', variant: 'muted' },
  running: { label: 'Running', variant: 'info' },
  waiting: { label: 'Waiting', variant: 'warning' },
  awaiting_approval: { label: 'Approval', variant: 'warning' },
  succeeded: { label: 'Succeeded', variant: 'success' },
  partially_succeeded: { label: 'Partial', variant: 'warning' },
  failed: { label: 'Failed', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
  timed_out: { label: 'Timed Out', variant: 'destructive' },
  paused: { label: 'Paused', variant: 'muted' },
  reconciliation_required: { label: 'Reconciliation', variant: 'destructive' },
};

export function RunStatusBadge({ status, className }) {
  const config = STATUS_MAP[status] ?? { label: status ?? 'Unknown', variant: 'muted' };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}