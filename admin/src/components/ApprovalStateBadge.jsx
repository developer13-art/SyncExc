import { Badge } from './ui/Badge.jsx';
import { APPROVAL_STATES } from '../lib/constants/app.constants.js';

const VARIANT_BY_STATE = {
  [APPROVAL_STATES.PENDING]: 'warning',
  [APPROVAL_STATES.APPROVED]: 'success',
  [APPROVAL_STATES.REJECTED]: 'destructive',
  [APPROVAL_STATES.EXPIRED]: 'muted',
  [APPROVAL_STATES.REVOKED]: 'destructive',
};

export function ApprovalStateBadge({ state, className }) {
  if (!state) {
    return null;
  }
  return (
    <Badge variant={VARIANT_BY_STATE[state] ?? 'muted'} className={className}>
      {state.replace(/_/g, ' ')}
    </Badge>
  );
}