import { Badge } from '../../ui/Badge.jsx';

const STATUS_MAP = {
  pending: { label: 'Pending', variant: 'muted' },
  trialing: { label: 'Trialing', variant: 'info' },
  active: { label: 'Active', variant: 'success' },
  past_due: { label: 'Past Due', variant: 'destructive' },
  grace_period: { label: 'Grace Period', variant: 'warning' },
  cancel_scheduled: { label: 'Cancel Scheduled', variant: 'warning' },
  canceled: { label: 'Canceled', variant: 'muted' },
  expired: { label: 'Expired', variant: 'destructive' },
  suspended: { label: 'Suspended', variant: 'destructive' },
};

export function SubscriptionStatusBadge({ status, className }) {
  const config = STATUS_MAP[status] ?? { label: status ?? 'Unknown', variant: 'muted' };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}