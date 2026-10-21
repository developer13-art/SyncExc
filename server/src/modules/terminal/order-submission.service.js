/**
 * SyncExc Server — Order submission service
 *
 * The critical path for placing an order:
 *   1. Idempotency check
 *   2. Instrument validation against the exchange adapter
 *   3. Pre-trade risk evaluation
 *   4. Persist execution request (durable intent)
 *   5. Dispatch to exchange adapter
 *   6. Handle the response — success, rejection, or uncertain outcome
 *   7. Persist order + fills, publish events
 *
 * Never retries a request whose outcome is uncertain. Instead, marks it
 * `reconciliation_required` and lets the reconciliation job check the
 * exchange.
 */

import { AppError, ValidationError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { ORDER_STATUS } from '@syncexc/shared';

export function createOrderSubmissionService({
  db,
  queries,
  connections,
  risk,
  executionService,
  events,
  idempotency,
  logger,
}) {
  /**
   * Submit an order.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.workspaceId
   * @param {string} params.connectionId
   * @param {string} params.accountId
   * @param {string} params.marketType
   * @param {string} params.instrumentId
   * @param {string} params.side
   * @param {string} params.type
   * @param {string} params.quantity
   * @param {string} [params.price]
   * @param {string} [params.triggerPrice]
   * @param {string} [params.timeInForce]
   * @param {boolean} [params.reduceOnly]
   * @param {string} [params.clientOrderId]
   * @param {string} params.idempotencyKey
   */
  async function submit(params, { confirmedExecutionRequestId = null } = {}) {
    const {
      userId,
      workspaceId,
      connectionId,
      accountId,
      marketType,
      instrumentId,
      side,
      type,
      quantity,
      price,
      triggerPrice,
      timeInForce,
      reduceOnly,
      clientOrderId,
      idempotencyKey,
    } = params;

    // 1. Idempotency check — return prior result if the key exists
    const existing = await queries.findExecutionRequestByKey(idempotencyKey);
    let approvedRequest = null;
    if (existing) {
      if (existing.state === 'completed' || existing.state === 'acknowledged') {
        const order = existing.payload?.orderId
          ? await queries.findOrderById(existing.payload.orderId)
          : null;
        return { executionRequest: existing, order, replayed: true };
      }
      if (existing.state === 'awaiting_confirmation') {
        if (!confirmedExecutionRequestId) {
          return {
            requiresConfirmation: true,
            executionRequest: existing,
            riskDecision: null,
          };
        }
        if (existing.id !== confirmedExecutionRequestId) {
          throw new ConflictError('Execution request does not match the pending approval', 'INVALID_STATE');
        }
        approvedRequest = existing;
      }
      if (existing.state === 'pending' || existing.state === 'submitting') {
        throw new ConflictError('An identical order is already in progress', 'ORDER_IN_PROGRESS');
      }
      if (['canceled', 'rejected', 'failed'].includes(existing.state)) {
        throw new ConflictError('This order request can no longer be submitted', 'INVALID_STATE');
      }
    }

    // 2. Load connection + credentials
    const connection = await connections.requireConnectionAccess({
      connectionId,
      workspaceId,
      operation: 'execute_trades',
    });
    if (connection.status !== 'active') {
      throw new ConflictError('Connection is not active', 'CONNECTION_NOT_ACTIVE');
    }

    const tradingAccount = await connections.requireAccountAccess({
      accountId,
      workspaceId,
      operation: 'execute_trades',
    });
    if (tradingAccount.connection_id !== connectionId || tradingAccount.status !== 'active') {
      throw new ConflictError('The selected account is not active on this connection', 'ACCOUNT_CONNECTION_MISMATCH');
    }

    const adapter = await connections.getAdapter(connection.exchange_code);
    if (!adapter) throw new NotFoundError('Exchange adapter');
    const marketSupported = marketType === 'spot'
      ? adapter.capabilities?.hasSpot
      : adapter.capabilities?.hasFutures;
    if (!marketSupported) {
      throw new ConflictError('This exchange does not support the selected market type', 'MARKET_TYPE_UNSUPPORTED');
    }
    await connections.requireVerifiedPermission({
      connectionId,
      permissionKey: 'trading',
    });
    const credentials = await connections.loadCredentials(connectionId);

    // 3. Verify instrument exists
    const instrument = await connections.getInstrument({
      exchangeCode: connection.exchange_code,
      symbol: instrumentId,
      marketType,
    });
    if (!instrument) throw new ValidationError(`Unknown instrument: ${instrumentId}`);
    if (instrument.trading_status !== 'active') {
      throw new ConflictError('Instrument is not tradable', 'INSTRUMENT_INACTIVE');
    }
    if (instrument.market_type !== marketType) {
      throw new ConflictError('Instrument does not belong to the selected market type', 'INSTRUMENT_MARKET_MISMATCH');
    }

    // 4. Pre-trade risk evaluation
    const riskDecision = await risk.evaluation.evaluate({
      workspaceId,
      operationType: 'order_submission',
      operationPayload: {
        connectionId,
        accountId,
        instrument: instrumentId,
        marketType,
        side,
        type,
        quantity,
        price,
      },
    });

    if (riskDecision.outcome === 'blocked') {
      if (approvedRequest) {
        await queries.updateExecutionRequest(approvedRequest.id, {
          state: 'rejected',
          completedAt: new Date(),
        });
      }
      throw new AppError(`Order blocked by risk policy: ${riskDecision.reasonCode}`, {
        code: 'RISK_BLOCKED',
        status: 422,
        expose: true,
        details: { reasonCode: riskDecision.reasonCode, checks: riskDecision.checkResults },
      });
    }

    if (
      (riskDecision.outcome === 'approval_required' ||
        riskDecision.outcome === 'confirmation_required') &&
      !approvedRequest
    ) {
      // Create a pending execution request; a separate endpoint approves it
      const executionRequest = await db.tx(async (tx) => {
        const req = await queries.insertExecutionRequest(tx, {
          workspaceId,
          connectionId,
          accountId,
          operationType: 'order_submission',
          state: 'awaiting_confirmation',
          payload: {
            connectionId,
            accountId,
            instrumentId,
            marketType,
            side,
            type,
            quantity,
            price,
            triggerPrice,
            timeInForce,
            reduceOnly,
            clientOrderId,
          },
          riskEvaluationId: riskDecision.id,
          idempotencyKey,
          correlationId: riskDecision.correlationId,
          createdBy: userId,
        });
        return req;
      });

      return {
        requiresConfirmation: true,
        executionRequest,
        riskDecision,
      };
    }

    // 5. Persist execution request
    const executionRequest = approvedRequest
      ? await queries.claimExecutionRequestForSubmission(approvedRequest.id)
      : await db.tx(async (tx) => {
          return queries.insertExecutionRequest(tx, {
            workspaceId,
            connectionId,
            accountId,
            operationType: 'order_submission',
            state: 'submitting',
            payload: {
              connectionId,
              accountId,
              instrumentId,
              marketType,
              side,
              type,
              quantity,
              price,
              triggerPrice,
              timeInForce,
              reduceOnly,
              clientOrderId,
            },
            riskEvaluationId: riskDecision.id,
            idempotencyKey,
            correlationId: riskDecision.correlationId,
            createdBy: userId,
          });
        });
    if (!executionRequest) {
      throw new ConflictError('Execution request is no longer awaiting approval', 'INVALID_STATE');
    }

    // 6. Persist a pending order row
    const order = await db.tx(async (tx) => {
      const o = await queries.insertOrder(tx, {
        workspaceId,
        connectionId,
        accountId,
        clientOrderId: clientOrderId || executionRequest.id,
        instrument: instrumentId,
        marketType,
        side,
        type,
        quantity,
        price,
        triggerPrice,
        timeInForce,
        reduceOnly,
        status: ORDER_STATUS.PENDING_SUBMISSION,
        source: 'terminal',
        relatedExecutionId: executionRequest.id,
      });

      await queries.insertOrderEvent(tx, {
        orderId: o.id,
        eventType: 'created',
        newStatus: ORDER_STATUS.PENDING_SUBMISSION,
      });

      return o;
    });

    // 7. Dispatch to exchange
    const started = Date.now();
    let adapterResponse = null;
    let adapterError = null;

    try {
      adapterResponse = await adapter.placeOrder({
        ...credentials,
        accountType: tradingAccount.account_type,
        environment: connection.environment,
        order: {
          instrument: instrumentId,
          marketType,
          side,
          type,
          quantity,
          price,
          triggerPrice,
          timeInForce,
          reduceOnly,
          clientOrderId: order.client_order_id,
        },
      });
    } catch (err) {
      adapterError = err;
      logger.warn(
        { err, orderId: order.id, exchange: connection.exchange_code },
        'Exchange order placement failed'
      );
    }

    const durationMs = Date.now() - started;

    // 8. Persist the attempt
    await db.tx(async (tx) => {
      await queries.insertExecutionAttempt(tx, {
        executionRequestId: executionRequest.id,
        attemptNumber: 1,
        requestPayload: {
          instrument: instrumentId,
          side,
          type,
          quantity,
          price,
        },
        responseStatus: adapterResponse ? 'success' : 'error',
        responsePayload: adapterResponse || adapterError?.exchangeResponse || null,
        errorMessage: adapterError?.message || null,
        completedAt: new Date(),
      });

      if (adapterResponse) {
        await queries.updateOrder(order.id, {
          exchangeOrderId: adapterResponse.exchangeOrderId,
          status: adapterResponse.status || ORDER_STATUS.SUBMITTED,
          filledQuantity: adapterResponse.filledQuantity || '0',
          averageFillPrice: adapterResponse.averageFillPrice || null,
        });

        await queries.insertOrderEvent(tx, {
          orderId: order.id,
          eventType: 'acknowledged',
          previousStatus: ORDER_STATUS.PENDING_SUBMISSION,
          newStatus: adapterResponse.status || ORDER_STATUS.SUBMITTED,
          payload: adapterResponse,
        });

        await queries.updateExecutionRequest(executionRequest.id, {
          state: 'acknowledged',
          completedAt: new Date(),
        });

        await events.publish(
          tx,
          'execution.order_acknowledged',
          {
            orderId: order.id,
            exchangeOrderId: adapterResponse.exchangeOrderId,
            status: adapterResponse.status,
          },
          {
            actorId: userId,
            workspaceId,
            resourceType: 'order',
            resourceId: order.id,
          }
        );
      } else if (adapterError) {
        const isAmbiguous = isAmbiguousError(adapterError);

        if (isAmbiguous) {
          // Mark for reconciliation, do NOT retry
          await queries.updateOrder(order.id, {
            status: ORDER_STATUS.RECONCILIATION_REQUIRED,
            metadata: { lastError: adapterError.message },
          });

          await queries.updateExecutionRequest(executionRequest.id, {
            state: 'reconciliation_required',
          });

          await events.publish(
            tx,
            'execution.outcome_uncertain',
            {
              orderId: order.id,
              error: adapterError.message,
            },
            {
              actorId: userId,
              workspaceId,
              resourceType: 'order',
              resourceId: order.id,
            }
          );
        } else {
          // Clear failure — mark rejected
          await queries.updateOrder(order.id, {
            status: ORDER_STATUS.REJECTED,
            rejectionReason: adapterError.message,
          });

          await queries.insertOrderEvent(tx, {
            orderId: order.id,
            eventType: 'rejected',
            previousStatus: ORDER_STATUS.PENDING_SUBMISSION,
            newStatus: ORDER_STATUS.REJECTED,
            payload: { error: adapterError.message },
          });

          await queries.updateExecutionRequest(executionRequest.id, {
            state: 'rejected',
            completedAt: new Date(),
          });

          await events.publish(
            tx,
            'execution.order_rejected',
            {
              orderId: order.id,
              reason: adapterError.message,
            },
            {
              actorId: userId,
              workspaceId,
              resourceType: 'order',
              resourceId: order.id,
            }
          );
        }
      }
    });

    const finalOrder = await queries.findOrderById(order.id);

    return {
      executionRequest,
      order: finalOrder,
      riskDecision,
      durationMs,
      ambiguous: isAmbiguousError(adapterError),
    };
  }

  function isAmbiguousError(err) {
    if (!err) return false;
    // Network timeouts / 5xx / connection resets → outcome uncertain
    if (err.code === 'ETIMEDOUT') return true;
    if (err.name === 'AbortError') return true;
    if (err.statusCode >= 500 && err.statusCode < 600) return true;
    if (err.statusCode === 408) return true;
    return false;
  }

  /**
   * Confirm a previously held order that required approval.
   */
  async function confirm({ userId, workspaceId, executionRequestId }) {
    const req = await queries.findExecutionRequestById(executionRequestId);
    if (!req) throw new NotFoundError('Execution request');
    if (req.workspace_id !== workspaceId) throw new NotFoundError('Execution request');
    if (req.state !== 'awaiting_confirmation') {
      throw new ConflictError('Execution request is not awaiting confirmation', 'INVALID_STATE');
    }

    // Convert the pending execution request into a live submission
    return submit(
      {
        userId,
        workspaceId,
        ...req.payload,
        idempotencyKey: req.idempotency_key,
      },
      { confirmedExecutionRequestId: req.id }
    );
  }

  async function cancelConfirmation({ userId, workspaceId, executionRequestId }) {
    const request = await queries.findExecutionRequestById(executionRequestId);
    if (!request || request.workspace_id !== workspaceId || request.created_by !== userId) {
      throw new NotFoundError('Execution request');
    }
    const canceled = await queries.cancelExecutionRequestIfAwaitingConfirmation(executionRequestId);
    if (!canceled) {
      throw new ConflictError('Execution request is no longer awaiting confirmation', 'INVALID_STATE');
    }
    return canceled;
  }

  return {
    submit,
    confirm,
    cancelConfirmation,
  };
}

export default createOrderSubmissionService;