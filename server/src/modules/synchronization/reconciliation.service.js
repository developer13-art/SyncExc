/**
 * SyncExc Server — Synchronization reconciliation
 */

import { NotFoundError } from '../../lib/errors.js';

export function createReconciliation({ db, queries, connections, terminal, events, logger }) {
  /**
   * Reconcile an operation's destinations against exchange state.
   */
  async function reconcileOperation(operationId) {
    const operation = await queries.findOperationById(operationId);
    if (!operation) throw new NotFoundError('Operation');

    const destinations = await queries.listDestinationOperations(operationId);

    for (const destOp of destinations) {
      if (!['outcome_unknown', 'reconciliation_required', 'pending'].includes(destOp.status)) {
        continue;
      }

      try {
        await reconcileDestinationOperation(destOp);
      } catch (err) {
        logger.error(
          { err, destinationOperationId: destOp.id },
          'Reconcile destination failed'
        );
      }
    }
  }

  async function reconcileDestinationOperation(destOp) {
    if (!destOp.destination_order_id) {
      // No order was ever acknowledged; leave as-is
      return;
    }

    // The terminal service has the exchange order. Query the exchange for
    // the current state and update the destination operation accordingly.
    const order = await terminal.service.getOrder(destOp.destination_order_id);
    if (!order || !order.order) return;

    const filledQuantity = order.order.filled_quantity || '0';

    await db.tx(async (tx) => {
      await queries.updateDestinationOperation(destOp.id, {
        status: order.order.status === 'filled' ? 'filled' : order.order.status,
        filledQuantity,
        completedAt: new Date(),
      });

      await events.publish(
        tx,
        'sync.reconciliation_completed',
        {
          operationId: destOp.operation_id,
          destinationId: destOp.destination_id,
          status: order.order.status,
        },
        {
          resourceType: 'sync_operation',
          resourceId: destOp.operation_id,
        }
      );
    });
  }

  /**
   * Finalize an operation's aggregate status based on its destinations.
   */
  async function finalizeOperation(operationId) {
    const destinations = await queries.listDestinationOperations(operationId);
    if (destinations.length === 0) return null;

    const statuses = destinations.map((d) => d.status);
    const allFilled = statuses.every((s) => s === 'filled');
    const anyFilled = statuses.some((s) => s === 'filled');
    const anyFailed = statuses.some((s) => ['rejected', 'risk_blocked', 'unsupported'].includes(s));
    const anyUnknown = statuses.some((s) => ['outcome_unknown', 'reconciliation_required'].includes(s));

    let status;
    if (allFilled) status = 'completed';
    else if (anyUnknown) status = 'reconciliation_required';
    else if (anyFilled && anyFailed) status = 'partially_completed';
    else if (anyFilled) status = 'completed_with_exceptions';
    else if (anyFailed) status = 'failed';
    else status = 'processing';

    return queries.updateOperation(operationId, {
      status,
      completedAt: ['completed', 'partially_completed', 'completed_with_exceptions', 'failed'].includes(status)
        ? new Date()
        : null,
    });
  }

  return {
    reconcileOperation,
    finalizeOperation,
  };
}

export default createReconciliation;