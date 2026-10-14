import { Badge } from './ui/Badge.jsx';
import { STATUS_COLORS } from '../lib/constants/ui.constants.js';

const LABEL_OVERRIDES = {
  pending_review: 'Pending review',
  require_confirmation: 'Require confirmation',
  require_approval: 'Require approval',
  wait_for_approval: 'Waiting for approval',
  reconciliation_required: 'Reconciliation required',
  completed_with_exceptions: 'Completed with exceptions',
  partially_succeeded: 'Partially succeeded',
  cancellation_requested: 'Cancellation requested',
  dead_lettered: 'Dead-lettered',
  needs_attention: 'Needs attention',
};

export function StatusBadge({ status, className, size = 'default' }) {
  if (!status) {
    return null;
  }
  const variant = STATUS_COLORS[status] ?? 'muted';
  const label =
    LABEL_OVERRIDES[status] ??
    status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge variant={variant} size={size} className={className}>
      {label}
    </Badge>
  );
}