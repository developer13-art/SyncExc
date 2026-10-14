/**
 * SyncExc Server — Terminal events
 */

export const TERMINAL_EMITS = [
  'execution.order_submitted',
  'execution.order_acknowledged',
  'execution.order_partially_filled',
  'execution.order_filled',
  'execution.order_rejected',
  'execution.order_canceled',
  'execution.outcome_uncertain',
];

export const TERMINAL_CONSUMES = [
  'connection.disconnected',
  'risk.emergency_pause_active',
];

export function registerTerminalEventHandlers({ events, service, logger }) {
  events.subscribe(
    'connection.disconnected',
    async (envelope) => {
      logger.info(
        { connectionId: envelope.payload.connectionId },
        'Connection disconnected — terminal will reject new orders for it'
      );
    },
    { name: 'terminal:connection-disconnected' }
  );

  events.subscribe(
    'risk.emergency_pause_active',
    async (envelope) => {
      logger.warn(
        { scope: envelope.payload.scope, scopeId: envelope.payload.scopeId },
        'Emergency pause active — terminal orders will be blocked'
      );
    },
    { name: 'terminal:emergency-pause' }
  );

  logger.debug(
    { emits: TERMINAL_EMITS.length, consumes: TERMINAL_CONSUMES.length },
    'Terminal event handlers registered'
  );
}

export default registerTerminalEventHandlers;