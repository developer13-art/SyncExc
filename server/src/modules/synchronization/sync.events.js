/**
 * SyncExc Server — Synchronization events
 */

export const SYNC_EMITS = [
  'sync.group_created',
  'sync.group_paused',
  'sync.group_resumed',
  'sync.destination_added',
  'sync.operation_created',
  'sync.operation_dispatched',
  'sync.operation_completed',
  'sync.operation_failed',
  'sync.reconciliation_required',
  'sync.reconciliation_completed',
];

export const SYNC_CONSUMES = [
  'execution.order_filled',
  'execution.order_rejected',
  'execution.outcome_uncertain',
];

export function registerSyncEventHandlers({ events, service, orchestrator, reconciliation, logger }) {
  // When an execution completes (order filled or rejected), finalize the
  // parent operation's status.
  events.subscribe(
    'execution.order_filled',
    async (envelope) => {
      if (envelope.payload?.syncOperationId) {
        try {
          await reconciliation.finalizeOperation(envelope.payload.syncOperationId);
        } catch (err) {
          logger.error({ err }, 'Failed to finalize operation after fill');
        }
      }
    },
    { name: 'sync:order-filled' }
  );

  events.subscribe(
    'execution.order_rejected',
    async (envelope) => {
      if (envelope.payload?.syncOperationId) {
        try {
          await reconciliation.finalizeOperation(envelope.payload.syncOperationId);
        } catch (err) {
          logger.error({ err }, 'Failed to finalize operation after rejection');
        }
      }
    },
    { name: 'sync:order-rejected' }
  );

  logger.debug(
    { emits: SYNC_EMITS.length, consumes: SYNC_CONSUMES.length },
    'Synchronization event handlers registered'
  );
}

export default registerSyncEventHandlers;