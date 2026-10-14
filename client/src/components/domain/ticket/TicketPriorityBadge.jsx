import { Badge } from '../../ui/Badge.jsx';

const PRIORITY_MAP = {
  low: { label: 'Low', variant: 'muted' },
  normal: { label: 'Normal', variant: 'info' },
  high: { label: 'High', variant: 'warning' },
  urgent: { label: 'Urgent', variant: 'destructive' },
};

export function TicketPriorityBadge({ priority, className }) {
  const config = PRIORITY_MAP[priority] ?? { label: priority ?? 'Normal', variant: 'muted' };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}