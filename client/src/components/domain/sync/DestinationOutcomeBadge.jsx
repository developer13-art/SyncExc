import { Badge } from '../../ui/Badge.jsx';

const OUTCOME_MAP = {
  queued: { label: 'Queued', variant: 'muted' },
  processing: { label: 'Processing', variant: 'warning' },
  submitted: { label: 'Submitted', variant: 'info' },
  acknowledged: { label: 'Acknowledged', variant: 'info' },
  filled: { label: 'Filled', variant: 'success' },
  partially_filled: { label: 'Partial Fill', variant: 'warning' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  failed: { label: 'Failed', variant: 'destructive' },
  held: { label: 'Held', variant: 'warning' },
  skipped: { label: 'Skipped', variant: 'muted' },
  reconciliation_required: { label: 'Reconciliation', variant: 'destructive' },
  outcome_unknown: { label: 'Unknown', variant: 'destructive' },
};

export function DestinationOutcomeBadge({ outcome, className }) {
  const config = OUTCOME_MAP[outcome] ?? { label: outcome ?? 'Unknown', variant: 'muted' };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}