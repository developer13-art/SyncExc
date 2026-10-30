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
import { normalizeOrderQuantity } from '../../lib/order-quantity.js';
import { compareDecimals, ORDER_STATUS } from '@syncexc/shared';
import { resolveBracketProtectionPlan } from '../connections/bracket-protection.policy.js';

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
  async function submit(
    params,
    { confirmedExecutionRequestId = null, source = 'terminal' } = {},
  ) {
    const {
      userId,
      workspaceId,
      connectionId,
      accountId,
      marketType: requestedMarketType,
      instrumentId,
      side,
      type: requestedOrderType,
      quantity: requestedQuantity,
      price,
      stopLoss,
      takeProfit,
      triggerPrice,
      timeInForce,
      reduceOnly,
      leverage,
      clientOrderId,
      idempotencyKey,
      destinationAccountIds = [],
    } = params;
    const marketType = requestedMarketType === 'perpetual' ? 'futures' : requestedMarketType;
    const type = String(requestedOrderType || '').toLowerCase();
    if (!['spot', 'futures'].includes(marketType)) {
      throw new ValidationError('Market type must be Spot or Futures/Perpetuals');
    }

    // 1. Idempotency check — return prior result if the key exists
    const existing = await queries.findExecutionRequestByKey(idempotencyKey);
    let approvedRequest = null;
    if (existing) {
      if (existing.state === 'completed' || existing.state === 'acknowledged') {
        const order = existing.payload?.orderId
          ? await queries.findOrderById(existing.payload.orderId)
          : null;
        if (!order) {
          throw new ConflictError(
            'The accepted order could not be located. Reconcile execution status before retrying.',
            'RECONCILIATION_REQUIRED',
          );
        }
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
      if (['unknown', 'reconciliation_required'].includes(existing.state)) {
        throw new ConflictError(
          'The exchange outcome is uncertain. Reconcile execution status before retrying.',
          'RECONCILIATION_REQUIRED',
        );
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
    const supportedOrderTypes = adapter.capabilities?.supportedOrderTypes;
    if (Array.isArray(supportedOrderTypes) && !supportedOrderTypes.includes(type)) {
      throw new ConflictError(
        `The selected exchange does not support ${type} orders`,
        'ORDER_TYPE_UNSUPPORTED',
      );
    }
    const protectionPlan = resolveBracketProtectionPlan({
      capabilities: adapter.capabilities,
      marketType,
      orderType: type,
      stopLoss,
      takeProfit,
    });
    if (!protectionPlan.supported) {
      logger.warn(
        {
          connectionId,
          accountId,
          exchange: connection.exchange_code,
          marketType,
          orderType: type,
          protectionStrategy: protectionPlan.strategy,
          warning: protectionPlan.warning,
        },
        'Order rejected by TP/SL compatibility policy',
      );
      throw new ConflictError(
        protectionPlan.warning,
        protectionPlan.code === 'MARKET_TYPE_UNSUPPORTED'
          ? 'MARKET_TYPE_UNSUPPORTED'
          : 'ATTACHED_PROTECTION_UNSUPPORTED',
      );
    }
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
    const quantity = normalizeOrderQuantity(
      requestedQuantity,
      instrument.quantity_step,
      instrument.minimum_quantity,
    );
    for (const [label, value] of [
      ['Price', price],
      ['Stop-loss price', stopLoss],
      ['Take-profit price', takeProfit],
      ['Trigger price', triggerPrice],
    ]) {
      if (
        value != null &&
        compareDecimals(
          normalizeOrderQuantity(value, instrument.tick_size),
          value,
        ) !== 0
      ) {
        throw new ValidationError(`${label} must align with the exchange price tick ${instrument.tick_size}`);
      }
    }

    await validateAvailableBalance({
      adapter,
      credentials,
      accountType: tradingAccount.account_type,
      environment: connection.environment,
      exchangeCode: connection.exchange_code,
      instrument,
      instrumentId,
      marketType,
      side,
      quantity,
      price,
      reduceOnly,
      leverage,
    });

    const syncDestinations = await validateSyncDestinations({
      userId,
      workspaceId,
      sourceAccountId: accountId,
      sourceInstrument: instrument,
      instrumentId,
      marketType,
      side,
      quantity,
      reduceOnly,
      leverage,
      destinationAccountIds,
    });

    // 4. Pre-trade risk evaluation
    const riskDecision = await risk.evaluation.evaluate({
      workspaceId,
      operationType: 'order_submission',
      operationPayload: {
        connectionId,
        accountId,
        instrument: instrumentId,
        instrumentScopeRef: instrument.id,
        marketType,
        side,
        type,
        quantity,
        price,
        leverage,
        stopLoss,
        takeProfit,
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
      if (source === 'terminal_sync') {
        throw new ConflictError(
          'Destination risk policy requires separate approval; no destination order was sent.',
          'SYNC_DESTINATION_APPROVAL_REQUIRED',
        );
      }

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
            leverage,
            stopLoss,
            takeProfit,
            triggerPrice,
            timeInForce,
            reduceOnly,
            clientOrderId,
            destinationAccountIds,
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
              stopLoss,
              takeProfit,
              triggerPrice,
              timeInForce,
              reduceOnly,
              clientOrderId,
              destinationAccountIds,
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
        clientOrderId: clientOrderId || normalizeClientOrderId(executionRequest.id),
        instrument: instrumentId,
        marketType,
        side,
        type,
        quantity,
        price,
        stopLoss,
        takeProfit,
        triggerPrice,
        timeInForce,
        reduceOnly,
        status: ORDER_STATUS.PENDING_SUBMISSION,
        source,
        relatedExecutionId: executionRequest.id,
        metadata: {
          ...(stopLoss ? { stopLoss } : {}),
          ...(takeProfit ? { takeProfit } : {}),
          ...(leverage ? { leverage } : {}),
          ...(syncDestinations.length > 0
            ? {
                terminalSync: {
                  status: 'waiting_for_source_fill',
                  destinations: syncDestinations.map((destination) => ({
                    ...destination,
                    status: 'waiting_for_source_fill',
                  })),
                },
              }
            : {}),
        },
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
          stopLoss,
          takeProfit,
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
          stopLoss,
          takeProfit,
        },
        responseStatus: adapterResponse ? 'success' : 'error',
        responsePayload: adapterResponse || adapterError?.exchangeResponse || null,
        errorMessage: adapterError?.message || null,
        completedAt: new Date(),
      });

      if (adapterResponse) {
        if (!adapterResponse.exchangeOrderId) {
          adapterError = Object.assign(
            new Error('Exchange acknowledged the request without returning an order ID'),
            { code: 'EXCHANGE_ORDER_ID_MISSING', exchangeResponse: adapterResponse },
          );
          await queries.updateOrder(order.id, {
            status: ORDER_STATUS.RECONCILIATION_REQUIRED,
            metadata: {
              providerErrorCode: adapterError.code,
              lastError: adapterError.message,
            },
          });
          await queries.updateExecutionRequest(executionRequest.id, {
            state: 'reconciliation_required',
            payload: { orderId: order.id },
          });
        } else {
          const responseStatus = String(adapterResponse.status || '').toLowerCase();
          if (['rejected', 'failed'].includes(responseStatus)) {
            const providerErrorCode =
              adapterResponse.errorCode ??
              adapterResponse.code ??
              adapterResponse.retCode ??
              null;
            const rejectionReason =
              adapterResponse.errorMessage ||
              adapterResponse.rejectionReason ||
              adapterResponse.message ||
              'The exchange rejected the order.';
            await queries.updateOrder(order.id, {
              exchangeOrderId: adapterResponse.exchangeOrderId,
              status: ORDER_STATUS.FAILED,
              rejectionReason,
              metadata: {
                providerErrorCode: providerErrorCode == null ? null : String(providerErrorCode),
                providerError: adapterResponse,
                lastError: rejectionReason,
              },
            });
            await queries.insertOrderEvent(tx, {
              orderId: order.id,
              eventType: 'rejected',
              previousStatus: ORDER_STATUS.PENDING_SUBMISSION,
              newStatus: ORDER_STATUS.FAILED,
              payload: { error: rejectionReason, errorCode: providerErrorCode },
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
                instrument: instrumentId,
                side,
                status: ORDER_STATUS.FAILED,
                reason: rejectionReason,
                errorCode: providerErrorCode,
              },
              {
                actorId: userId,
                workspaceId,
                resourceType: 'order',
                resourceId: order.id,
              },
            );
          } else {
            // A placement response is only an acknowledgement. Never trust
            // its fill status until fetchOrder confirms current exchange state.
            await queries.updateOrder(order.id, {
              exchangeOrderId: adapterResponse.exchangeOrderId,
              status: ORDER_STATUS.SUBMITTED,
              filledQuantity: '0',
              averageFillPrice: null,
            });

            await queries.insertOrderEvent(tx, {
              orderId: order.id,
              eventType: 'acknowledged',
              previousStatus: ORDER_STATUS.PENDING_SUBMISSION,
              newStatus: ORDER_STATUS.SUBMITTED,
              payload: adapterResponse,
            });

            await queries.updateExecutionRequest(executionRequest.id, {
              state: 'acknowledged',
              completedAt: new Date(),
              payload: { orderId: order.id },
            });

            await events.publish(
              tx,
              'execution.order_acknowledged',
              {
                orderId: order.id,
                exchangeOrderId: adapterResponse.exchangeOrderId,
                instrument: instrumentId,
                side,
                status: ORDER_STATUS.SUBMITTED,
              },
              {
                actorId: userId,
                workspaceId,
                resourceType: 'order',
                resourceId: order.id,
              },
            );
          }
        }
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
            payload: { orderId: order.id },
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
          // A definite exchange/API error is a terminal failure, not a fill.
          const providerErrorCode =
            adapterError.exchangeResponse?.code ??
            adapterError.exchangeResponse?.retCode ??
            adapterError.exchangeResponse?.errorCode ??
            adapterError.code ??
            adapterError.statusCode ??
            null;
          await queries.updateOrder(order.id, {
            status: ORDER_STATUS.FAILED,
            rejectionReason: adapterError.message,
            metadata: {
              providerErrorCode: providerErrorCode == null ? null : String(providerErrorCode),
              providerError: adapterError.exchangeResponse || null,
              lastError: adapterError.message,
            },
          });

          await queries.insertOrderEvent(tx, {
            orderId: order.id,
            eventType: 'rejected',
            previousStatus: ORDER_STATUS.PENDING_SUBMISSION,
            newStatus: ORDER_STATUS.FAILED,
            payload: { error: adapterError.message, errorCode: providerErrorCode },
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
              instrument: instrumentId,
              side,
              status: ORDER_STATUS.FAILED,
              reason: adapterError.message,
              errorCode: providerErrorCode,
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

    let finalOrder = await queries.findOrderById(order.id);
    if (
      adapterResponse?.exchangeOrderId &&
      finalOrder?.status !== ORDER_STATUS.RECONCILIATION_REQUIRED &&
      typeof adapter.fetchOrder === 'function'
    ) {
      finalOrder = await reconcileAfterSubmission({
        adapter,
        credentials,
        accountType: tradingAccount.account_type,
        environment: connection.environment,
        order: finalOrder,
        exchangeCode: connection.exchange_code,
      }) || finalOrder;
    }

    return {
      executionRequest,
      order: finalOrder,
      riskDecision,
      durationMs,
      ambiguous: isAmbiguousError(adapterError),
    };
  }

  async function validateSyncDestinations({
    userId,
    workspaceId,
    sourceAccountId,
    sourceInstrument,
    instrumentId,
    marketType,
    side,
    quantity,
    reduceOnly,
    leverage,
    destinationAccountIds,
  }) {
    if (destinationAccountIds == null) {
      return [];
    }
    if (!Array.isArray(destinationAccountIds) || destinationAccountIds.length > 10) {
      throw new ValidationError('Select no more than 10 synchronization destinations');
    }
    if (destinationAccountIds.length === 0) {
      return [];
    }
    if (new Set(destinationAccountIds).size !== destinationAccountIds.length) {
      throw new ValidationError('Synchronization destinations must be unique');
    }

    const destinations = [];
    const failures = [];

    for (const destinationAccountId of destinationAccountIds) {
      try {
        if (destinationAccountId === sourceAccountId) {
          throw new ConflictError('The source account cannot also be a synchronization destination');
        }

        const destinationAccount = await connections.requireAccountAccess({
          accountId: destinationAccountId,
          workspaceId,
          operation: 'execute_trades',
        });
        if (destinationAccount.status !== 'active') {
          throw new ConflictError('Destination account is not active', 'ACCOUNT_NOT_ACTIVE');
        }
        const destinationConnection = await connections.requireConnectionAccess({
          connectionId: destinationAccount.connection_id,
          workspaceId,
          operation: 'execute_trades',
        });
        if (destinationConnection.status !== 'active') {
          throw new ConflictError('Destination connection is not active', 'CONNECTION_NOT_ACTIVE');
        }

        const adapter = await connections.getAdapter(destinationConnection.exchange_code);
        const normalizedMarketType = marketType === 'perpetual' ? 'futures' : marketType;
        const marketSupported = normalizedMarketType === 'spot'
          ? adapter?.capabilities?.hasSpot
          : adapter?.capabilities?.hasFutures;
        if (!adapter || !marketSupported) {
          throw new ConflictError(
            `Destination exchange does not support ${normalizedMarketType} trading`,
            'MARKET_TYPE_UNSUPPORTED',
          );
        }
        if (
          Array.isArray(adapter.capabilities?.supportedOrderTypes) &&
          !adapter.capabilities.supportedOrderTypes.includes('market')
        ) {
          throw new ConflictError('Destination exchange does not support market orders', 'ORDER_TYPE_UNSUPPORTED');
        }
        await connections.requireVerifiedPermission({
          connectionId: destinationConnection.id,
          permissionKey: 'trading',
        });

        const instrument = await connections.getInstrument({
          exchangeCode: destinationConnection.exchange_code,
          symbol: instrumentId,
          marketType: normalizedMarketType,
        });
        if (!instrument || instrument.trading_status !== 'active') {
          throw new ConflictError(
            `Destination does not have an active ${instrumentId} instrument`,
            'INSTRUMENT_UNAVAILABLE',
          );
        }
        if (
          String(instrument.base_asset).toUpperCase() !==
            String(sourceInstrument.base_asset).toUpperCase() ||
          String(instrument.quote_asset).toUpperCase() !==
            String(sourceInstrument.quote_asset).toUpperCase()
        ) {
          throw new ConflictError(
            `Destination ${instrumentId} uses different base or quote assets`,
            'INSTRUMENT_ASSET_MISMATCH',
          );
        }
        if (instrument.market_type !== normalizedMarketType) {
          throw new ConflictError('Destination instrument does not support the selected market type', 'INSTRUMENT_MARKET_MISMATCH');
        }

        const destinationQuantity = normalizeOrderQuantity(
          quantity,
          instrument.quantity_step,
          instrument.minimum_quantity,
        );
        const credentials = await connections.loadCredentials(destinationConnection.id);
        await validateAvailableBalance({
          adapter,
          credentials,
          accountType: destinationAccount.account_type,
          environment: destinationConnection.environment,
          exchangeCode: destinationConnection.exchange_code,
          instrument,
          instrumentId,
          marketType: normalizedMarketType,
          side,
          quantity: destinationQuantity,
          reduceOnly,
          leverage,
        });

        const riskDecision = await risk.evaluation.evaluate({
          workspaceId,
          operationType: 'order_submission',
          operationPayload: {
            connectionId: destinationConnection.id,
            accountId: destinationAccountId,
            instrument: instrumentId,
            instrumentScopeRef: instrument.id,
            marketType: normalizedMarketType,
            side,
            type: 'market',
            quantity: destinationQuantity,
            leverage,
            reduceOnly,
          },
        });
        if (!['allowed', 'approved'].includes(riskDecision.outcome)) {
          throw new ConflictError(
            `Destination risk checks did not approve the order (${riskDecision.reasonCode || riskDecision.outcome})`,
            'SYNC_DESTINATION_RISK_BLOCKED',
          );
        }

        destinations.push({
          accountId: destinationAccountId,
          connectionId: destinationConnection.id,
          quantity: destinationQuantity,
          label: [
            destinationConnection.label || destinationConnection.exchange_code,
            destinationConnection.environment,
            destinationAccount.account_type,
          ]
            .filter(Boolean)
            .join(' · '),
        });
      } catch (error) {
        failures.push(`${destinationAccountId}: ${error.message}`);
      }
    }

    if (failures.length > 0) {
      throw new ConflictError(
        `Synchronization destination preflight failed: ${failures.join('; ')}`,
        'SYNC_DESTINATION_PREFLIGHT_FAILED',
      );
    }

    return destinations;
  }

  async function syncFilledOrder({ orderId }) {
    const order = await queries.findOrderById(orderId);
    const terminalSync = order?.metadata?.terminalSync;
    if (!order || !Array.isArray(terminalSync?.destinations) || terminalSync.destinations.length === 0) {
      return { processed: 0 };
    }
    if (order.status !== ORDER_STATUS.FILLED) {
      return { processed: 0, waitingForSourceFill: true };
    }
    if (terminalSync.status === 'completed' || terminalSync.status === 'completed_with_errors') {
      return { processed: 0, alreadyProcessed: true };
    }

    const executionRequest = await queries.findExecutionRequestById(order.related_execution_id);
    if (!executionRequest?.created_by) {
      throw new NotFoundError('Source execution request');
    }

    let updatedSync = {
      ...terminalSync,
      status: 'processing',
      destinations: terminalSync.destinations.map((destination) => ({ ...destination })),
    };
    await persistTerminalSync(order, updatedSync);

    for (let index = 0; index < updatedSync.destinations.length; index += 1) {
      const destination = updatedSync.destinations[index];
      if (['submitted', 'filled', 'failed', 'reconciliation_required'].includes(destination.status)) {
        continue;
      }

      destination.status = 'submitting';
      await persistTerminalSync(order, updatedSync);

      try {
        const result = await submit(
          {
            userId: executionRequest.created_by,
            workspaceId: order.workspace_id,
            connectionId: destination.connectionId,
            accountId: destination.accountId,
            instrumentId: order.instrument,
            marketType: order.market_type,
            side: order.side,
            type: 'market',
            quantity:
              Number(order.filled_quantity) > 0
                ? order.filled_quantity
                : destination.quantity || order.quantity,
            reduceOnly: order.reduce_only,
            leverage: order.metadata?.leverage,
            idempotencyKey: `terminal-sync-${order.id.replaceAll('-', '')}-${destination.accountId.replaceAll('-', '')}`,
          },
          { source: 'terminal_sync' },
        );

        if (result.requiresConfirmation || !result.order) {
          destination.status = 'failed';
          destination.error = result.requiresConfirmation
            ? 'Destination requires a separate approval; no destination order was sent.'
            : 'Destination order was not created.';
        } else if (result.ambiguous || result.order.status === ORDER_STATUS.RECONCILIATION_REQUIRED) {
          destination.status = 'reconciliation_required';
          destination.orderId = result.order.id;
          destination.error = 'Destination exchange outcome is uncertain; reconcile before retrying.';
        } else if ([ORDER_STATUS.FAILED, ORDER_STATUS.REJECTED].includes(result.order.status)) {
          destination.status = 'failed';
          destination.orderId = result.order.id;
          destination.error = result.order.rejection_reason || 'Destination exchange rejected the order.';
        } else {
          destination.status =
            result.order.status === ORDER_STATUS.FILLED ? 'filled' : 'submitted';
          destination.orderId = result.order.id;
          delete destination.error;
        }
      } catch (error) {
        destination.status = 'failed';
        destination.error = error instanceof Error ? error.message : String(error);
        logger.error(
          { err: error, sourceOrderId: order.id, destinationAccountId: destination.accountId },
          'Terminal synchronization destination failed',
        );
      }
      await persistTerminalSync(order, updatedSync);
    }

    updatedSync.status = updatedSync.destinations.every((destination) =>
      ['submitted', 'filled'].includes(destination.status),
    )
      ? 'completed'
      : 'completed_with_errors';
    await persistTerminalSync(order, updatedSync);
    return { processed: updatedSync.destinations.length, status: updatedSync.status };
  }

  async function persistTerminalSync(order, terminalSync) {
    await queries.updateOrder(order.id, {
      metadata: {
        ...(order.metadata || {}),
        terminalSync,
      },
    });
  }

  async function reconcileAfterSubmission({
    adapter,
    credentials,
    accountType,
    environment,
    order,
    exchangeCode,
  }) {
    let currentOrder = order;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        const update = await adapter.fetchOrder({
          ...credentials,
          accountType,
          environment,
          instrument: currentOrder.instrument,
          marketType: currentOrder.market_type,
          exchangeOrderId: currentOrder.exchange_order_id,
          includeFills: true,
        });
        if (!update?.exchangeOrderId || update.exchangeOrderId !== currentOrder.exchange_order_id) {
          logger.warn(
            { orderId: currentOrder.id, exchangeCode },
            'Exchange status response did not confirm the submitted order ID',
          );
          continue;
        }
        await executionService.handleExecutionUpdate({
          connectionId: currentOrder.connection_id,
          update,
        });
        currentOrder = await queries.findOrderById(currentOrder.id) || currentOrder;
        if (
          [ORDER_STATUS.FILLED, ORDER_STATUS.REJECTED, ORDER_STATUS.FAILED, ORDER_STATUS.CANCELED,
            ORDER_STATUS.EXPIRED].includes(currentOrder.status)
        ) return currentOrder;
      } catch (err) {
        logger.warn(
          { err, orderId: currentOrder.id, exchangeCode, attempt: attempt + 1 },
          'Exchange order state reconciliation attempt failed',
        );
      }
    }
    return currentOrder;
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

  async function validateAvailableBalance({
    adapter,
    credentials,
    accountType,
    environment,
    exchangeCode,
    instrument,
    instrumentId,
    marketType,
    side,
    quantity,
    price,
    reduceOnly,
    leverage,
  }) {
    if (reduceOnly) return;
    if (typeof adapter.fetchAccountState !== 'function' &&
      typeof adapter.fetchBalances !== 'function') {
      throw new ConflictError(
        'Exchange balance validation is unavailable; no order was submitted.',
        'BALANCE_VALIDATION_UNAVAILABLE',
      );
    }

    const accountState = typeof adapter.fetchAccountState === 'function'
      ? await adapter.fetchAccountState({ ...credentials, accountType, environment })
      : { balances: await adapter.fetchBalances({ ...credentials, accountType, environment }) };
    const balances = Array.isArray(accountState?.balances) ? accountState.balances : [];
    const normalizedMarketType = marketType === 'spot' ? 'spot' : 'futures';
    const isSpotSell = normalizedMarketType === 'spot' && side === 'sell';
    const requiredAsset = isSpotSell ? instrument.base_asset : instrument.quote_asset;
    const balance = balances.find(
      (item) => String(item.asset || '').toUpperCase() === String(requiredAsset || '').toUpperCase(),
    );
    const rawAvailableEquity = accountState?.availableEquity ?? accountState?.availableMargin;
    let available = normalizedMarketType === 'futures' && rawAvailableEquity != null
      ? Number(rawAvailableEquity)
      : Number(balance?.free ?? balance?.available ?? balance?.availableBalance ?? 0);

    let required;
    if (isSpotSell) {
      required = Number(quantity);
    } else {
      let referencePrice = Number(price);
      if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
        const marketData = connections.marketData;
        referencePrice = normalizedMarketType === 'spot'
          ? Number(await marketData?.getSpotPrice?.({ exchangeCode, symbol: instrumentId }))
          : Number((await marketData?.getMarketData?.({
              exchangeCode,
              symbol: instrumentId,
              marketType: normalizedMarketType,
              limit: 25,
            }))?.overview?.lastPrice);
      }
      if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
        throw new ConflictError(
          `A valid reference price is unavailable to verify ${requiredAsset} funds; no order was submitted.`,
          'BALANCE_VALIDATION_PRICE_UNAVAILABLE',
        );
      }
      required = Number(quantity) * referencePrice;
      if (normalizedMarketType === 'futures') {
        required /= Math.max(1, Number(leverage) || 1);
      }
    }

    if (!Number.isFinite(available) || !Number.isFinite(required) || available < required) {
      throw new ConflictError(
        `Insufficient ${requiredAsset} balance: available ${Number.isFinite(available) ? available : 0}, required ${Number.isFinite(required) ? required : 'unknown'}.`,
        'INSUFFICIENT_BALANCE',
      );
    }
  }

  function normalizeClientOrderId(value) {
    const normalized = String(value || '').replaceAll('-', '');
    return normalized.slice(0, 32) || null;
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
    syncFilledOrder,
    confirm,
    cancelConfirmation,
  };
}

export default createOrderSubmissionService;