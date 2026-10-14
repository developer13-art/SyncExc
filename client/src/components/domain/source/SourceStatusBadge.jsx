import { Badge } from '../../ui/Badge.jsx';

const STATUS_MAP = {
  pending_review: { label: 'Pending Review', variant: 'warning' },
  approved_for_validation: { label: 'Validating', variant: 'info' },
  validation_in_progress: { label: 'Validating', variant: 'info' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  additional_information_required: { label: 'Info Required', variant: 'warning' },
  suspended: { label: 'Suspended', variant: 'destructive' },
  archived: { label: 'Archived', variant: 'muted' },
  active: { label: 'Active', variant: 'success' },
  paused: { label: 'Paused', variant: 'muted' },
  disconnected: { label: 'Disconnected', variant: 'muted' },
  needs_attention: { label: 'Attention', variant: 'warning' },
};

export function SourceStatusBadge({ status, className }) {
  const config = STATUS_MAP[status] ?? { label: status ?? 'Unknown', variant: 'muted' };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}