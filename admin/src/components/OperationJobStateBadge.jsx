import { Badge } from './ui/Badge.jsx';
import { OPERATION_JOB_STATES } from '../lib/constants/app.constants.js';

const VARIANT_BY_STATE = {
  [OPERATION_JOB_STATES.QUEUED]: 'muted',
  [OPERATION_JOB_STATES.VALIDATING]: 'warning',
  [OPERATION_JOB_STATES.RUNNING]: 'info',
  [OPERATION_JOB_STATES.WAITING_FOR_APPROVAL]: 'warning',
  [OPERATION_JOB_STATES.PARTIALLY_SUCCEEDED]: 'warning',
  [OPERATION_JOB_STATES.SUCCEEDED]: 'success',
  [OPERATION_JOB_STATES.FAILED]: 'destructive',
  [OPERATION_JOB_STATES.CANCELLATION_REQUESTED]: 'warning',
  [OPERATION_JOB_STATES.CANCELLED]: 'muted',
  [OPERATION_JOB_STATES.RECONCILIATION_REQUIRED]: 'destructive',
};

export function OperationJobStateBadge({ state, className }) {
  if (!state) {
    return null;
  }
  return (
    <Badge variant={VARIANT_BY_STATE[state] ?? 'muted'} className={className}>
      {state.replace(/_/g, ' ')}
    </Badge>
  );
}