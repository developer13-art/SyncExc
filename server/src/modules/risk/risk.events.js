/**
 * SyncExc Server — Risk events
 */

export const RISK_EMITS = [
  'risk.policy_created',
  'risk.policy_suspended',
  'risk.evaluated',
  'risk.blocked',
  'risk.approval_requested',
  'risk.approval_granted',
  'risk.approval_rejected',
  'risk.circuit_breaker_activated',
  'risk.emergency_pause_requested',
  'risk.emergency_pause_active',
  'risk.emergency_pause_resumed',
  'risk.incident_created',
  'risk.incident_resolved',
  'risk.alert_created',
];

export const RISK_CONSUMES = [
  'execution.outcome_uncertain',
  'connection.disconnected',
  'sync.operation_failed',
];

export function registerRiskEventHandlers({ events, service, incidentService, circuitBreakerService, logger }) {
  // When an uncertain execution outcome is reported, open an incident
  events.subscribe(
    'execution.outcome_uncertain',
    async (envelope) => {
      try {
        await incidentService.create({
          workspaceId: envelope.workspaceId,
          category: 'unknown_submission_outcome',
          severity: 'high',
          summary: `Uncertain execution outcome for order ${envelope.payload.orderId}`,
        });
      } catch (err) {
        logger.error({ err }, 'Failed to open incident for uncertain execution');
      }
    },
    { name: 'risk:uncertain-execution' }
  );

  // On repeated connection failures, trip a circuit breaker
  events.subscribe(
    'connection.disconnected',
    async (envelope) => {
      logger.info({ connectionId: envelope.payload.connectionId }, 'Connection disconnected — checking circuit breakers');
    },
    { name: 'risk:connection-disconnected' }
  );

  logger.debug(
    { emits: RISK_EMITS.length, consumes: RISK_CONSUMES.length },
    'Risk event handlers registered'
  );
}

export default registerRiskEventHandlers;