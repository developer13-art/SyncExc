/**
 * SyncExc Server — Automation events
 */

export const AUTOMATION_EMITS = [
  'automation.workflow_created',
  'automation.workflow_published',
  'automation.workflow_paused',
  'automation.workflow_resumed',
  'automation.trigger_fired',
  'automation.schedule_fired',
  'automation.run_started',
  'automation.run_completed',
  'automation.run_failed',
  'automation.approval_required',
];

export const AUTOMATION_CONSUMES = [
  'marketplace.signal_published',
  'signal.eligible',
  'source.health_changed',
  'connection.status_changed',
  'sync.operation_completed',
  'risk.evaluated',
  'risk.circuit_breaker_activated',
  'risk.emergency_pause_active',
];

export default {
  AUTOMATION_EMITS,
  AUTOMATION_CONSUMES,
};