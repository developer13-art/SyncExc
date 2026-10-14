/**
 * SyncExc Server — Synchronization dispatcher
 *
 * For each destination operation:
 *   1. Resolve instrument mapping
 *   2. Compute the destination quantity via the sizing policy
 *   3. Run pre-trade risk evaluation on the destination
 *   4. Submit the order through the terminal
 *   5. Record the outcome
 *
 * Partial failures are the norm: some destinations succeed, others fail.
 * We never auto-compensate a failed destination by increasing others.
 */

import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { DESTINATION_OUTCOME, SIZING_POLICY_TYPE } from '@syncexc/shared';

export function createDispatcher({
  db,
  queries,
  connections,
  terminal,
  risk,
  retryScheduler,
  events,
  logger,
}) {
  const queue = [];
  let draining = false;

  function enqueueDispatch(destinationOperationId) {
    queue.push(destinationOperationId);
    if (!draining) drain();
  }

  async function drain() {
    draining = true;
    while (queue.length > 0) {
      const id = queue.shift();
      try {
        await dispatchDestinationOperation(id);
      } catch (err) {
        logger.error({ err, destinationOperationId: id }, 'Dispatch failed');
      }
    }
    draining = false;
  }

  async function dispatchDestinationOperation(destinationOperationId) {
    const destOp = await queries.findDestinationOperationById(destinationOperationId);
    if (!destOp) throw new NotFoundError('Destination operation');

    if (destOp.status !== 'pending') {
      logger.debug(
        { destinationOperationId, status: destOp.status },
        'Destination operation already processed'
      );
      return;
    }

    const operation = await queries.findOperationById(destOp.operation_id);
    const destination = await queries.findDestinationById(destOp.destination_id);
    if (!operation || !destination) throw new NotFoundError('Operation or destination');

    const group = await queries.findGroupById(operation.group_id);
    const sourceEvent = await queries.findSourceEventById(operation.source_event_id);

    // 1. Resolve instrument mapping
    const mapping = await queries.findInstrumentMapping(
      group.id,
      destination.id,
      operation.source_instrument
    );

    let destinationInstrument = operation.source_instrument;
    let conversionFactor = null;
    if (mapping) {
      destinationInstrument = mapping.destination_instrument;
      conversionFactor = mapping.conversion_factor ? Number(mapping.conversion_factor) : null;
    }

    // 2. Compute the sizing policy
    let destinationQuantity;
    try {
      destinationQuantity = await computeSizedQuantity({
        policy: destination.sizing_policy_id
          ? await queries.findSizingPolicyById(destination.sizing_policy_id)
          : null,
        sourceEvent,
        operation,
        conversionFactor,
        destination,
      });
    } catch (err) {
      await recordFailure({
        destOp,
        operation,
        errorCode: 'SIZING_ERROR',
        errorMessage: err.message,
        retryable: false,
      });
      return;
    }

    if (!destinationQuantity || Number(destinationQuantity) <= 0) {
      await recordFailure({
        destOp,
        operation,
        errorCode: 'INVALID_QUANTITY',
        errorMessage: 'Sizing policy produced an invalid quantity',
        retryable: false,
      });
      return;
    }

    // 3. Pre-trade risk evaluation on the destination
    let riskDecision;
    try {
      riskDecision = await risk.evaluation.evaluate({
        workspaceId: group.workspace_id,
        operationType: 'order_submission',
        operationPayload: {
          connectionId: destination.connection_id,
          accountId: destination.account_id,
          instrument: destinationInstrument,
          marketType: group.market_types[0],
          side: sourceEvent.payload?.side || inferSideFromEvent(sourceEvent),
          type: 'market',
          quantity: destinationQuantity,
        },
      });
    } catch (err) {
      logger.error({ err, destinationOperationId }, 'Risk evaluation failed');
      await recordFailure({
        destOp,
        operation,
        errorCode: 'RISK_EVAL_FAILED',
        errorMessage: err.message,
        retryable: true,
      });
      return;
    }

    if (riskDecision.outcome === 'blocked') {
      await recordFailure({
        destOp,
        operation,
        errorCode: 'RISK_BLOCKED',
        errorMessage: `Blocked by ${riskDecision.reasonCode}`,
        retryable: false,
      });
      return;
    }

    if (riskDecision.outcome !== 'approved') {
      await recordFailure({
        destOp,
        operation,
        errorCode: 'RISK_NOT_APPROVED',
        errorMessage: `Risk outcome: ${riskDecision.outcome}`,
        retryable: false,
      });
      return;
    }

    // 4. Submit via terminal
    const idempotencyKey = `sync-dispatch:${destOp.idempotency_key}`;

    let submissionResult;
    try {
      submissionResult = await terminal.publicApi.submitOrder({
        userId: group.created_by,
        workspaceId: group.workspace_id,
        connectionId: destination.connection_id,
        accountId: destination.account_id,
        marketType: group.market_types[0],
        instrumentId: destinationInstrument,
        side: sourceEvent.payload?.side || inferSideFromEvent(sourceEvent),
        type: 'market',
        quantity: destinationQuantity,
        idempotencyKey,
      });
    } catch (err) {
      logger.error({ err, destinationOperationId }, 'Order submission failed');
      const retryable = err.retryable !== false;
      await recordFailure({
        destOp,
        operation,
        errorCode: err.code || 'SUBMISSION_FAILED',
        errorMessage: err.message,
        retryable,
      });
      return;
    }

    // 5. Success or ambiguous
    const orderId = submissionResult.order?.id || null;
    const ambiguous = submissionResult.ambiguous;

    await db.tx(async (tx) => {
      await queries.updateDestinationOperation(destOp.id, {
        status: ambiguous
          ? DESTINATION_OUTCOME.OUTCOME_UNKNOWN
          : submissionResult.order?.status === 'filled'
          ? DESTINATION_OUTCOME.FILLED
          : DESTINATION_OUTCOME.ACKNOWLEDGED,
        destinationOrderId: orderId,
        attemptIncrement: 1,
        completedAt: ambiguous ? null : new Date(),
      });

      await queries.insertDestinationAttempt(tx, {
        destinationOperationId: destOp.id,
        attemptNumber: 1,
        requestPayload: {
          instrument: destinationInstrument,
          quantity: destinationQuantity,
        },
        responseStatus: ambiguous ? 'ambiguous' : 'success',
        responsePayload: submissionResult.order,
        errorMessage: null,
        completedAt: new Date(),
      });

      await queries.updateOperation(destOp.operation_id, {
        status: SYNC_STATUS.PROCESSING,
      });

      await events.publish(
        tx,
        ambiguous ? 'sync.reconciliation_required' : 'sync.operation_dispatched',
        {
          operationId: destOp.operation_id,
          destinationId: destOp.destination_id,
          orderId,
          quantity: destinationQuantity,
        },
        {
          workspaceId: group.workspace_id,
          resourceType: 'sync_operation',
          resourceId: destOp.operation_id,
        }
      );
    });
  }

  /* ===========================================================================
   * SIZING
   * ======================================================================== */

  async function computeSizedQuantity({ policy, sourceEvent, operation, conversionFactor, destination }) {
    if (!policy) {
      // Fallback to source quantity (with conversion)
      const sourceQty = operation.requested_quantity || sourceEvent.payload?.quantity;
      if (!sourceQty) throw new Error('No source quantity available');
      return conversionFactor
        ? String(Number(sourceQty) * conversionFactor)
        : String(sourceQty);
    }

    const config = policy.config || {};

    switch (policy.policy_type) {
      case SIZING_POLICY_TYPE.FIXED_QUANTITY:
        return String(config.fixedQuantity);

      case SIZING_POLICY_TYPE.FIXED_QUOTE_VALUE: {
        const price = sourceEvent.payload?.price;
        if (!price) throw new Error('Price required for fixed quote sizing');
        return String(Number(config.fixedQuoteValue) / Number(price));
      }

      case SIZING_POLICY_TYPE.PROPORTIONAL_SOURCE_QUANTITY: {
        const sourceQty = operation.requested_quantity || sourceEvent.payload?.quantity;
        if (!sourceQty) throw new Error('No source quantity available');
        const scaled = Number(sourceQty) * Number(config.scaleFactor || 1);
        return String(scaled);
      }

      case SIZING_POLICY_TYPE.CAPPED_PROPORTIONAL: {
        const sourceQty = operation.requested_quantity || sourceEvent.payload?.quantity;
        if (!sourceQty) throw new Error('No source quantity available');
        let qty = Number(sourceQty) * Number(config.scaleFactor || 1);
        if (config.maxQuantity) qty = Math.min(qty, Number(config.maxQuantity));
        return String(qty);
      }

      case SIZING_POLICY_TYPE.BALANCE_BASED_SCALING:
      case SIZING_POLICY_TYPE.RISK_LIMITED_SIZING:
        // These require account context; would consult the account service
        // For now, fall back to source quantity
        return String(operation.requested_quantity || sourceEvent.payload?.quantity || 0);

      default:
        throw new Error(`Unsupported sizing policy: ${policy.policy_type}`);
    }
  }

  function inferSideFromEvent(sourceEvent) {
    const p = sourceEvent.payload || {};
    return p.side || 'buy';
  }

  /* ===========================================================================
   * FAILURE HANDLING
   * ======================================================================== */

  async function recordFailure({ destOp, operation, errorCode, errorMessage, retryable }) {
    await db.tx(async (tx) => {
      await queries.updateDestinationOperation(destOp.id, {
        status: DESTINATION_OUTCOME.REJECTED,
        errorCode,
        errorMessage: String(errorMessage).slice(0, 500),
        attemptIncrement: 1,
        completedAt: new Date(),
      });

      await queries.insertDestinationAttempt(tx, {
        destinationOperationId: destOp.id,
        attemptNumber: 1,
        requestPayload: {},
        responseStatus: 'error',
        errorClass: errorCode,
        errorMessage,
        completedAt: new Date(),
      });

      await events.publish(
        tx,
        'sync.operation_failed',
        {
          operationId: operation.id,
          destinationId: destOp.destination_id,
          errorCode,
          errorMessage,
        },
        {
          resourceType: 'sync_operation',
          resourceId: operation.id,
        }
      );

      // Schedule a retry if retryable
      if (retryable) {
        const retryJob = await queries.insertRetryJob(tx, {
          destinationOperationId: destOp.id,
          attemptNumber: 1,
          scheduledAt: new Date(Date.now() + 30000),
          failureCategory: errorCode,
        });
        logger.info(
          { destinationOperationId: destOp.id, retryJobId: retryJob.id },
          'Retry scheduled'
        );
      }
    });
  }

  async function handleOutcome({ destinationOperationId, outcome }) {
    const destOp = await queries.findDestinationOperationById(destinationOperationId);
    if (!destOp) return;

    await queries.updateDestinationOperation(destOp.id, {
      status: outcome.status,
      filledQuantity: outcome.filledQuantity,
      completedAt: new Date(),
    });
  }

  return {
    enqueueDispatch,
    dispatchDestinationOperation,
    handleOutcome,
  };
}

export default createDispatcher;