/**
 * SyncExc Server — Admin events
 */

export const ADMIN_EMITS = [
  'admin.role_changed',
  'admin.approval_requested',
  'admin.approval_granted',
  'admin.approval_rejected',
  'admin.action_executed',
  'admin.feature_flag_changed',
  'admin.plan_created',
  'admin.exchange_restricted',
  'admin.alert_created',
  'admin.operation_job_cancellation',
];

export const ADMIN_CONSUMES = [];

export default {
  ADMIN_EMITS,
  ADMIN_CONSUMES,
};