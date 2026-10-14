import { Badge } from '../../ui/Badge.jsx';

const STATUS_MAP = {
  new: { label: 'New', variant: 'info' },
  open: { label: 'Open', variant: 'info' },
  assigned: { label: 'Assigned', variant: 'info' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  waiting_for_customer: { label: 'Waiting for You', variant: 'warning' },
  waiting_for_internal_team: { label: 'Waiting Internal', variant: 'warning' },
  escalated: { label: 'Escalated', variant: 'destructive' },
  resolved: { label: 'Resolved', variant: 'success' },
  closed: { label: 'Closed', variant: 'muted' },
  reopened: { label: 'Reopened', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
};

export function TicketStatusBadge({ status, className }) {
  const config = STATUS_MAP[status] ?? { label: status ?? 'Unknown', variant: 'muted' };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}