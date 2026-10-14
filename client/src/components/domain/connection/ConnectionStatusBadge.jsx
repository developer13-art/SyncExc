import { Badge } from '../../ui/Badge.jsx';

const STATUS_MAP = {
  pending: { label: 'Pending', variant: 'muted' },
  validating: { label: 'Validating', variant: 'warning' },
  active: { label: 'Active', variant: 'success' },
  degraded: { label: 'Degraded', variant: 'warning' },
  reauth_required: { label: 'Reauth Required', variant: 'warning' },
  suspended: { label: 'Suspended', variant: 'destructive' },
  disconnected: { label: 'Disconnected', variant: 'muted' },
  revoked: { label: 'Revoked', variant: 'destructive' },
  error: { label: 'Error', variant: 'destructive' },
};

export function ConnectionStatusBadge({ status, className }) {
  const config = STATUS_MAP[status] ?? { label: status ?? 'Unknown', variant: 'muted' };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}