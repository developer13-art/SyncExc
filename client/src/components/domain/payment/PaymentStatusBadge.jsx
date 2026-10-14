import { Badge } from '../../ui/Badge.jsx';

const STATUS_MAP = {
  pending: { label: 'Pending', variant: 'muted' },
  processing: { label: 'Processing', variant: 'warning' },
  succeeded: { label: 'Succeeded', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  refunded: { label: 'Refunded', variant: 'muted' },
  partially_refunded: { label: 'Partially Refunded', variant: 'warning' },
  disputed: { label: 'Disputed', variant: 'destructive' },
};

export function PaymentStatusBadge({ status, className }) {
  const config = STATUS_MAP[status] ?? { label: status ?? 'Unknown', variant: 'muted' };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}