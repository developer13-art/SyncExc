/**
 * SyncExc Server — Copy orchestration
 *
 * When a provider publishes a signal, this service:
 *   1. Resolves every active copy configuration for that provider
 *   2. Applies filters (instrument, market type)
 *   3. Computes sizing for each destination
 *   4. Runs risk evaluation per destination
 *   5. Creates an execution intent per destination or skips with a reason
 *
 * Every subscriber-destination pair is tracked independently. Partial
 * failures never roll back successful destinations.
 */

import { fnv1aHash } from '@syncexc/shared';
import { COPY_PROCESSING_OUTCOME, COPY_SKIP_REASON } from '@syncexc/shared';
import { AuthorizationError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { resolveBracketProtectionPlan } from '../connections/bracket-protection.policy.js';

export function createCopyOrchestrationService({
  db,
  queries,
  subscriptionService,
  copyConfigurationService,
  risk,
  terminal,
  connections,
  marketData,
  events,
  logger,
}) {
  async function processPublishedSignal({ publishedSignalId }) {
    const signal = await queries.findPublishedSignalById(publishedSignalId);
    if (!signal) return;
    if (signal.status !== 'published') return;

    // Find all active configs across workspaces for this provider
    const configs = await queries.listActiveCopyConfigurationsForProvider(signal.provider_id);

    logger.info(
      { signalId: publishedSignalId, configCount: configs.length },
      'Processing published signal for copy'
    );

    for (const config of configs) {
      try {
        await processConfigForSignal({ config, signal });
      } catch (err) {
        logger.error(
          { err, configId: config.id, signalId: publishedSignalId },
          'Copy config processing failed'
        );
      }
    }
  }

  async function copySignalNow({
    userId,
    workspaceId,
    signalId,
    configId,
    destinationAccountIds,
    amount,
    canApproveExecution = false,
  }) {
    const signal = await queries.findPublishedSignalById(signalId);
    if (!signal || !['published', 'updated'].includes(signal.status)) {
      throw new NotFoundError('Published signal');
    }

    const config = await queries.findCopyConfigurationById(configId);
    if (
      !config ||
      config.workspace_id !== workspaceId ||
      config.created_by !== userId ||
      config.provider_id !== signal.provider_id ||
      config.status !== 'active'
    ) {
      throw new NotFoundError('Active copy configuration');
    }

    const subscription = await subscriptionService.getSubscription({
      userId,
      providerId: signal.provider_id,
    });
    if (!subscription) {
      throw new ConflictError('An active subscription is required to copy this signal', 'SUBSCRIPTION_REQUIRED');
    }

    if (destinationAccountIds || amount != null) {
      if (
        !Array.isArray(destinationAccountIds) ||
        destinationAccountIds.length === 0 ||
        !Number.isFinite(Number(amount)) ||
        Number(amount) <= 0
      ) {
        throw new ConflictError('Select at least one destination and enter a positive amount', 'INVALID_COPY_ALLOCATION');
      }
      if (config.execution_mode === 'monitor_only') {
        throw new ConflictError('Monitor-only configurations cannot submit copy orders', 'COPY_EXECUTION_UNAVAILABLE');
      }
      if (
        (config.instrument_filters?.length > 0 &&
          !config.instrument_filters.includes(signal.instrument)) ||
        (config.market_types && !config.market_types.includes(signal.market_type))
      ) {
        throw new ConflictError('This signal is outside the active copy configuration filters', 'COPY_NOT_ELIGIBLE');
      }
      if ((signal.order_type || 'market') === 'limit' && !signal.entry) {
        throw new ConflictError('Limit-order signals need an exact entry price before they can be copied', 'COPY_NOT_ELIGIBLE');
      }

      const destinations = await queries.listCopyDestinations(config.id);
      const selected = destinations.filter((destination) =>
        destinationAccountIds.includes(destination.account_id)
      );
      if (selected.length !== new Set(destinationAccountIds).size) {
        throw new NotFoundError('Configured destination account');
      }

      const requestConfig = {
        ...config,
        subscriber_user_id: userId,
        sizing_rule: {
          type: 'fixed_notional',
          config: { amount: String(amount) },
        },
      };
      await db.tx((tx) =>
        queries.cancelPendingCopyIntentsForSignal(signal.id, config.id, tx)
      );
      const results = [];
      for (const destination of selected) {
        let record;
        try {
          record = await processDestination({
            config: requestConfig,
            signal,
            destination,
            manualCopy: true,
          });
        } catch (err) {
          logger.warn(
            { err, signalId: signal.id, accountId: destination.account_id },
            'Copy destination was skipped after validation failed',
          );
          record = await recordSkip({
            config: requestConfig,
            signal,
            destination,
            reason: COPY_SKIP_REASON.DESTINATION_DISCONNECTED,
            message: `Exchange validation failed; no order was submitted: ${err.message}`,
          });
        }
        if (!record) {
          results.push({ status: 'already_processed', accountId: destination.account_id });
        } else if (record.outcome === COPY_PROCESSING_OUTCOME.HELD) {
          try {
            results.push({
              ...(await confirmRecord({
            userId,
            workspaceId,
            recordId: record.id,
            canApproveExecution,
              })),
              accountId: destination.account_id,
            });
          } catch (err) {
            logger.warn(
              { err, signalId: signal.id, accountId: destination.account_id },
              'Copy order outcome requires reconciliation',
            );
            results.push({
              status: 'reconciliation_required',
              errorMessage: err.message,
              accountId: destination.account_id,
            });
          }
        } else {
          results.push({
            status: record.outcome,
            skipReason: record.skip_reason || null,
            errorMessage: record.destination_error || record.error_message || null,
            accountId: destination.account_id,
          });
        }
      }
      return { results };
    }

    let records = await queries.listCopyRecordsForSignalConfiguration(
      signalId,
      configId,
      workspaceId
    );
    if (records.length === 0) {
      await processConfigForSignal({ config: { ...config, subscriber_user_id: userId }, signal });
      records = await queries.listCopyRecordsForSignalConfiguration(
        signalId,
        configId,
        workspaceId
      );
    }

    if (records.length === 0) {
      throw new ConflictError('No destination is eligible to copy this signal', 'COPY_NOT_ELIGIBLE');
    }

    const results = [];
    for (const record of records) {
      if (record.subscriber_user_id !== userId) {
        throw new NotFoundError('Copy record');
      }
      if (record.outcome === COPY_PROCESSING_OUTCOME.HELD) {
        results.push(await confirmRecord({
          userId,
          workspaceId,
          recordId: record.id,
          canApproveExecution,
        }));
      } else {
        results.push({
          status: record.outcome,
          skipReason: record.skip_reason || null,
          errorMessage: record.error_message || record.rejection_reason || null,
        });
      }
    }
    return { results };
  }

  async function processConfigForSignal({ config, signal }) {
    const destinations = await queries.listCopyDestinations(config.id);

    // Apply instrument filter
    if (
      config.instrument_filters &&
      config.instrument_filters.length > 0 &&
      !config.instrument_filters.includes(signal.instrument)
    ) {
      await recordSkip({
        config,
        signal,
        destination: null,
        reason: COPY_SKIP_REASON.INSTRUMENT_UNSUPPORTED,
        message: 'Instrument not in filter list',
      });
      return;
    }

    // Apply market type filter
    if (config.market_types && !config.market_types.includes(signal.market_type)) {
      await recordSkip({
        config,
        signal,
        destination: null,
        reason: COPY_SKIP_REASON.INSTRUMENT_UNSUPPORTED,
        message: 'Market type not in filter list',
      });
      return;
    }

    if ((signal.order_type || 'market') === 'limit' && !signal.entry) {
      await recordSkip({
        config,
        signal,
        destination: null,
        reason: COPY_SKIP_REASON.INVALID_ALLOCATION,
        message: 'Limit-order signals need an exact entry price before they can be copied',
      });
      return;
    }

    // For each destination, run the full pipeline
    for (const destination of destinations) {
      try {
        await processDestination({ config, signal, destination });
      } catch (err) {
        logger.error(
          { err, configId: config.id, signalId: signal.id, destinationId: destination.id },
          'Destination processing failed'
        );

        await recordSkip({
          config,
          signal,
          destination,
          reason: COPY_SKIP_REASON.RECONCILIATION_REQUIRED,
          message: err.message,
        });
      }
    }
  }

  async function processDestination({ config, signal, destination, manualCopy = false }) {
    // Skip if the destination connection is not active
    if (destination.connection_status !== 'active') {
      return recordSkip({
        config,
        signal,
        destination,
        reason: COPY_SKIP_REASON.DESTINATION_DISCONNECTED,
        message: `Connection status: ${destination.connection_status}`,
      });
    }
    if (destination.account_status !== 'active') {
      return recordSkip({
        config,
        signal,
        destination,
        reason: COPY_SKIP_REASON.DESTINATION_DISCONNECTED,
        message: `Account status: ${destination.account_status}`,
      });
    }

    let referencePrice = signal.entry == null ? null : Number(signal.entry);
    if (referencePrice == null) {
      try {
        referencePrice = await fetchReferencePrice(
          marketData,
          destination.exchange_code,
          signal.instrument,
          signal.market_type,
        );
      } catch (err) {
        return recordSkip({
          config,
          signal,
          destination,
          reason: COPY_SKIP_REASON.INVALID_ALLOCATION,
          message: `Could not get a market price for sizing and balance validation: ${err.message}`,
        });
      }
    }

    // Compute the sizing
    let allocation;
    try {
      allocation = computeAllocation({
        sizingRule: config.sizing_rule,
        signal,
        referencePrice,
      });
    } catch (err) {
      return recordSkip({
        config,
        signal,
        destination,
        reason: COPY_SKIP_REASON.INVALID_ALLOCATION,
        message: err.message,
      });
    }

    if (!allocation || Number(allocation.quantity) <= 0) {
      return recordSkip({
        config,
        signal,
        destination,
        reason: COPY_SKIP_REASON.INVALID_ALLOCATION,
        message: 'Sizing produced invalid quantity',
      });
    }

    const destinationCheck = await validateDestination({
      destination,
      signal,
      quantity: allocation.quantity,
      referencePrice,
    });
    if (!destinationCheck.valid) {
      return recordSkip({
        config,
        signal,
        destination,
        reason: destinationCheck.reason,
        message: destinationCheck.message,
      });
    }

    // Risk evaluation
    let riskDecision;
    try {
      riskDecision = await risk.evaluation.evaluate({
        workspaceId: config.workspace_id,
        operationType: 'order_submission',
        operationPayload: {
          connectionId: destination.connection_id,
          accountId: destination.account_id,
          instrument: signal.instrument,
          marketType: signal.market_type,
          side: signal.direction === 'long' ? 'buy' : 'sell',
          type: signal.order_type || 'market',
          quantity: allocation.quantity,
          price: signal.entry ?? referencePrice,
          stopLoss: signal.stop_loss ?? null,
          takeProfit: resolveTakeProfit(signal.targets),
        },
      });
    } catch (err) {
      return recordSkip({
        config,
        signal,
        destination,
        reason: COPY_SKIP_REASON.RISK_LIMIT_EXCEEDED,
        message: `Risk evaluation failed: ${err.message}`,
      });
    }

    if (riskDecision.outcome === 'blocked') {
      return recordSkip({
        config,
        signal,
        destination,
        reason: COPY_SKIP_REASON.RISK_LIMIT_EXCEEDED,
        message: `Blocked: ${riskDecision.reasonCode}`,
      });
    }

    // Determine outcome based on execution mode
    let outcome;
    if (config.execution_mode === 'monitor_only') {
      outcome = COPY_PROCESSING_OUTCOME.SKIPPED;
    } else {
      outcome = COPY_PROCESSING_OUTCOME.HELD;
    }

    // Record the processing
    const requestFingerprint = manualCopy
      ? `manual:${config.sizing_rule?.config?.amount}`
      : 'configured';
    const operationKey = `${signal.id}:${config.id}:${destination.id}:${config.current_version}:${requestFingerprint}`;
    const idempotencyKey = fnv1aHash(
      `copy:${operationKey}`
    );

    const record = await db.tx(async (tx) => {
      const r = await queries.insertCopyProcessingRecord(tx, {
        publishedSignalId: signal.id,
        configId: config.id,
        subscriberUserId: config.subscriber_user_id,
        configVersion: config.current_version,
        outcome,
        skipReason:
          outcome === COPY_PROCESSING_OUTCOME.SKIPPED && config.execution_mode === 'monitor_only'
            ? COPY_SKIP_REASON.CONFIRMATION_REQUIRED
            : null,
        allocationDecision: allocation,
        riskEvaluationId: riskDecision.id,
        idempotencyKey,
      });

      if (!r) return null; // Duplicate

      await queries.insertCopyDestinationResult(tx, {
        processingRecordId: r.id,
        destinationAccountId: destination.id,
        outcome,
        skipReason: config.execution_mode === 'monitor_only' ? 'monitor_only' : null,
      });

      if (outcome === COPY_PROCESSING_OUTCOME.HELD) {
        const intent = await queries.insertCopyExecutionIntent(tx, {
          processingRecordId: r.id,
          payload: {
            userId: config.subscriber_user_id,
            workspaceId: config.workspace_id,
            connectionId: destination.connection_id,
            accountId: destination.account_id,
            instrumentId: signal.instrument,
            marketType: signal.market_type,
            side: signal.direction === 'long' ? 'buy' : 'sell',
            type: signal.order_type || 'market',
            quantity: allocation.quantity,
            stopLoss: signal.stop_loss ?? null,
            takeProfit: resolveTakeProfit(signal.targets),
            ...(signal.order_type === 'limit' ? { price: signal.entry } : {}),
            idempotencyKey: fnv1aHash(`copy-submit:${operationKey}`),
          },
          idempotencyKey: fnv1aHash(`copy-intent:${operationKey}`),
        });
        await queries.updateCopyProcessingRecord(r.id, { executionIntentId: intent.id }, tx);
      }

      await events.publish(
        tx,
        'marketplace.copy_signal_processed',
        {
          recordId: r.id,
          configId: config.id,
          signalId: signal.id,
          destinationId: destination.id,
          outcome,
        },
        {
          workspaceId: config.workspace_id,
          resourceType: 'copy_processing_record',
          resourceId: r.id,
        }
      );

      return r;
    });

    return record;
  }

  async function validateDestination({ destination, signal, quantity, referencePrice }) {
    if (!connections) {
      return {
        valid: false,
        reason: COPY_SKIP_REASON.RECONCILIATION_REQUIRED,
        message: 'Exchange validation is unavailable; no order was submitted.',
      };
    }

    const marketType = signal.market_type === 'spot' ? 'spot' : 'futures';
    const adapter = await connections.getAdapter(destination.exchange_code);
    const supportsMarket = marketType === 'spot'
      ? adapter?.capabilities?.hasSpot
      : adapter?.capabilities?.hasFutures;
    if (!supportsMarket) {
      return {
        valid: false,
        reason: COPY_SKIP_REASON.INSTRUMENT_UNSUPPORTED,
        message: `This exchange does not support ${signal.market_type}.`,
      };
    }
    if (marketType === 'spot' && signal.direction === 'short') {
      return {
        valid: false,
        reason: COPY_SKIP_REASON.INSTRUMENT_UNSUPPORTED,
        message: 'Spot destination accounts cannot open short positions.',
      };
    }
    const orderType = signal.order_type || 'market';
    const supportedOrderTypes = adapter.capabilities?.supportedOrderTypes;
    if (Array.isArray(supportedOrderTypes) && !supportedOrderTypes.includes(orderType)) {
      return {
        valid: false,
        reason: COPY_SKIP_REASON.ORDER_TYPE_UNSUPPORTED,
        message: `This exchange does not support ${orderType} orders for ${signal.market_type}.`,
      };
    }
    const protectionPlan = resolveBracketProtectionPlan({
      capabilities: adapter.capabilities,
      marketType,
      orderType,
      stopLoss: signal.stop_loss,
      takeProfit: resolveTakeProfit(signal.targets),
    });
    if (!protectionPlan.supported) {
      return {
        valid: false,
        reason: COPY_SKIP_REASON.PROTECTION_UNSUPPORTED,
        message: protectionPlan.warning,
      };
    }

    const instrument = await connections.getInstrument({
      exchangeCode: destination.exchange_code,
      symbol: signal.instrument,
      marketType,
    });
    if (
      !instrument ||
      instrument.trading_status !== 'active' ||
      (instrument.market_type && instrument.market_type !== marketType)
    ) {
      return {
        valid: false,
        reason: COPY_SKIP_REASON.INSTRUMENT_UNSUPPORTED,
        message: `This exchange does not have an active ${signal.instrument} market.`,
      };
    }

    const credentials = await connections.loadCredentials(destination.connection_id);
    const balanceParams = {
      ...credentials,
      accountType: destination.account_type,
      environment: destination.environment,
    };
    const state = adapter.fetchAccountState
      ? await adapter.fetchAccountState(balanceParams)
      : { balances: await adapter.fetchBalances(balanceParams) };
    const health = String(state?.status || state?.health || '').toLowerCase();
    if (state?.error || ['error', 'unhealthy', 'degraded', 'disabled'].includes(health)) {
      return {
        valid: false,
        reason: COPY_SKIP_REASON.DESTINATION_DISCONNECTED,
        message: `Exchange account health check failed${health ? ` (${health})` : ''}.`,
      };
    }

    const baseAsset = instrument.base_asset;
    const quoteAsset = instrument.quote_asset;
    const sellingSpot = marketType === 'spot' && signal.direction === 'short';
    const balanceAsset = sellingSpot ? baseAsset : quoteAsset;
    const balance = state.balances?.find((item) => item.asset === balanceAsset);
    const hasAvailableEquity = state.availableEquity != null || state.availableMargin != null;
    const availableEquity = Number(state.availableEquity ?? state.availableMargin);
    const available = marketType === 'futures' && hasAvailableEquity && Number.isFinite(availableEquity)
      ? availableEquity
      : Number(balance?.free ?? balance?.available ?? 0);
    const notional = Number(quantity) * Number(referencePrice);
    const leverage = Math.max(1, Number(signal.leverage) || 1);
    const required = sellingSpot ? Number(quantity)
      : marketType === 'futures' ? notional / leverage : notional;
    if (
      !Number.isFinite(available) ||
      !Number.isFinite(required) ||
      available < required
    ) {
      return {
        valid: false,
        reason: COPY_SKIP_REASON.INVALID_ALLOCATION,
        message: `Insufficient ${balanceAsset} balance for the requested amount.`,
      };
    }
    return { valid: true, instrument };
  }

  function computeAllocation({ sizingRule, signal, referencePrice }) {
    if (!sizingRule || typeof sizingRule !== 'object') {
      throw new Error('Sizing rule is required');
    }

    const { type, config } = sizingRule;

    switch (type) {
      case 'fixed_amount': {
        const amount = Number(config?.amount || 0);
        if (amount <= 0) throw new Error('Fixed amount must be positive');
        return {
          type,
          quantity: String(amount),
          reasoning: `Fixed amount ${amount}`,
        };
      }

      case 'fixed_percentage': {
        const sizingPrice = signal.entry == null ? referencePrice : Number(signal.entry);
        if (!Number.isFinite(sizingPrice) || sizingPrice <= 0) {
          throw new Error('Signal has no valid price for percentage sizing');
        }
        const percentage = Number(config?.percentage || 0);
        const accountBase = Number(config?.accountBase || 1000);
        const quantity = (accountBase * (percentage / 100)) / sizingPrice;
        return {
          type,
          quantity: String(quantity),
          reasoning: `${percentage}% of ${accountBase} at ${sizingPrice}`,
        };
      }

      case 'fixed_notional': {
        const notional = Number(config?.amount || 0);
        const sizingPrice = signal.entry == null ? Number(referencePrice) : Number(signal.entry);
        if (!Number.isFinite(notional) || notional <= 0) {
          throw new Error('Investment amount must be positive');
        }
        if (!Number.isFinite(sizingPrice) || sizingPrice <= 0) {
          throw new Error('A valid price is required to size this investment amount');
        }
        return {
          type,
          notional: String(notional),
          quantity: String(notional / sizingPrice),
          reasoning: `Quote-currency amount ${notional} at ${sizingPrice}`,
        };
      }

      case 'provider_relative':
      case 'user_defined':
      default:
        throw new Error(`Unsupported sizing rule: ${type}`);
    }
  }

  async function recordSkip({ config, signal, destination, reason, message }) {
    logger?.warn?.(
      {
        signalId: signal.id,
        configId: config.id,
        destinationAccountId: destination?.account_id || null,
        reason,
        warning: message,
      },
      'Copy destination skipped by pre-trade validation',
    );
    const idempotencyKey = fnv1aHash(
      `copy-skip:${signal.id}:${config.id}:${destination?.id || 'none'}:${reason}`
    );

    const result = await db.tx(async (tx) => {
      const record = await queries.insertCopyProcessingRecord(tx, {
        publishedSignalId: signal.id,
        configId: config.id,
        subscriberUserId: config.subscriber_user_id,
        configVersion: config.current_version,
        outcome: COPY_PROCESSING_OUTCOME.SKIPPED,
        skipReason: reason,
        allocationDecision: null,
        riskEvaluationId: null,
        executionIntentId: null,
        idempotencyKey,
      });

      if (!record) return null;

      if (destination) {
        await queries.insertCopyDestinationResult(tx, {
          processingRecordId: record.id,
          destinationAccountId: destination.id,
          outcome: COPY_PROCESSING_OUTCOME.SKIPPED,
          skipReason: reason,
          errorMessage: message,
        });
      }

      await events.publish(
        tx,
        'marketplace.copy_signal_processed',
        {
          recordId: record.id,
          configId: config.id,
          signalId: signal.id,
          destinationId: destination?.id || null,
          outcome: COPY_PROCESSING_OUTCOME.SKIPPED,
          skipReason: reason,
          message,
        },
        {
          workspaceId: config.workspace_id,
          resourceType: 'copy_processing_record',
          resourceId: record.id,
        }
      );
      return { ...record, destination_error: message };
    });
    return result;
  }

  async function confirmRecord({ userId, workspaceId, recordId, canApproveExecution = false }) {
    const record = await queries.findCopyRecordForConfirmation(recordId, workspaceId);
    if (!record || record.subscriber_user_id !== userId) throw new NotFoundError('Copy confirmation');
    if (record.outcome !== COPY_PROCESSING_OUTCOME.HELD || !record.copy_intent_id) {
      throw new ConflictError('This copy signal is not awaiting confirmation', 'INVALID_STATE');
    }

    const initialIntent = typeof record.intent_payload === 'string'
      ? JSON.parse(record.intent_payload)
      : record.intent_payload;
    const intentStatus = record.intent_status;
    if (!['awaiting_confirmation', 'terminal_confirmation_required'].includes(intentStatus)) {
      throw new ConflictError('This copy confirmation has already been processed', 'INVALID_STATE');
    }
    if (intentStatus === 'terminal_confirmation_required' && !canApproveExecution) {
      throw new AuthorizationError('Approval permission is required for this terminal risk check', 'PERMISSION_DENIED');
    }
    const intent = await queries.claimCopyExecutionIntent(
      record.copy_intent_id,
      intentStatus
    );
    if (!intent) {
      throw new ConflictError('This copy confirmation is already being processed', 'INVALID_STATE');
    }
    const payload = typeof intent.intent_payload === 'string'
      ? JSON.parse(intent.intent_payload)
      : intent.intent_payload || initialIntent;
    const isTerminalApproval = intentStatus === 'terminal_confirmation_required';

    if (isTerminalApproval && !terminal?.confirmExecution) {
      await queries.updateCopyExecutionIntent(record.copy_intent_id, {
        status: 'terminal_confirmation_required',
      });
      throw new ConflictError('Terminal approval is unavailable', 'COPY_EXECUTION_UNAVAILABLE');
    }
    if (!isTerminalApproval && !terminal?.submitOrder) {
      await queries.updateCopyExecutionIntent(record.copy_intent_id, {
        status: 'awaiting_confirmation',
      });
      throw new ConflictError('Order submission is not available', 'COPY_EXECUTION_UNAVAILABLE');
    }

    try {
      const result = isTerminalApproval
        ? await terminal.confirmExecution({
            userId,
            workspaceId,
            executionRequestId: payload.executionRequestId,
          })
        : await terminal.submitOrder({
            userId,
            workspaceId,
            connectionId: payload.connectionId,
            accountId: payload.accountId,
            instrumentId: payload.instrumentId,
            marketType: payload.marketType,
            side: payload.side,
            type: payload.type,
            quantity: payload.quantity,
            price: payload.price,
            stopLoss: payload.stopLoss,
            takeProfit: payload.takeProfit,
            idempotencyKey: payload.idempotencyKey,
          });

      if (result.requiresConfirmation) {
        const updatedIntent = { ...payload, executionRequestId: result.executionRequest.id };
        await queries.updateCopyExecutionIntent(record.copy_intent_id, {
          status: 'terminal_confirmation_required',
          payload: updatedIntent,
        });
        return {
          status: 'terminal_confirmation_required',
          executionRequestId: result.executionRequest.id,
        };
      }

      if (result.ambiguous) {
        await markCopyRecordFailed(record, 'reconciliation_required', 'reconciliation_required');
        return { status: 'reconciliation_required' };
      }

      const finalOrderStatus = String(result.order?.status || '').toLowerCase();
      const rejectedStatuses = new Set(['rejected', 'failed', 'canceled', 'cancelled']);
      if (!result.order || rejectedStatuses.has(finalOrderStatus)) {
        const rejectionMessage = result.order?.rejection_reason ||
          'The exchange did not accept this order.';
        await markCopyRecordFailed(
          record,
          rejectedStatuses.has(finalOrderStatus) ? 'rejected' : 'failed',
          'execution_rejected',
          rejectionMessage,
          result.order?.id,
        );
        logger?.warn?.(
          {
            signalId: record.published_signal_id,
            accountId: payload.accountId,
            orderId: result.order?.id || null,
            orderStatus: finalOrderStatus || 'missing_order',
            warning: rejectionMessage,
          },
          'Copy order was not accepted by the exchange',
        );
        return {
          status: rejectedStatuses.has(finalOrderStatus) ? 'rejected' : 'failed',
          orderId: result.order?.id || null,
          errorMessage: rejectionMessage,
        };
      }

      await db.tx(async (tx) => {
        await queries.updateCopyExecutionIntent(record.copy_intent_id, { status: 'submitted' }, tx);
        await queries.updateCopyProcessingRecord(recordId, {
          outcome: COPY_PROCESSING_OUTCOME.EXECUTED,
        }, tx);
        await queries.updateCopyDestinationResult(recordId, {
          outcome: COPY_PROCESSING_OUTCOME.EXECUTED,
          destinationOrderId: result.order?.id || null,
        }, tx);
      });
      return { status: 'submitted', orderId: result.order?.id || null };
    } catch (err) {
      await markCopyRecordFailed(record, 'reconciliation_required', 'reconciliation_required');
      throw err;
    }
  }

  async function markCopyRecordFailed(record, intentStatus, reason, errorMessage, destinationOrderId) {
    await db.tx(async (tx) => {
      await queries.updateCopyExecutionIntent(record.copy_intent_id, { status: intentStatus }, tx);
      await queries.updateCopyProcessingRecord(record.id, {
        outcome: COPY_PROCESSING_OUTCOME.FAILED,
        skipReason: reason,
      }, tx);
      await queries.updateCopyDestinationResult(record.id, {
        outcome: COPY_PROCESSING_OUTCOME.FAILED,
        skipReason: reason,
        errorMessage,
        destinationOrderId,
      }, tx);
    });
  }

  async function listRecordsForWorkspace(workspaceId, { limit }) {
    return queries.listCopyProcessingRecordsForWorkspace(workspaceId, { limit });
  }

  return {
    processPublishedSignal,
    copySignalNow,
    confirmRecord,
    listRecordsForWorkspace,
  };
}

function resolveTakeProfit(targets) {
  const parsed = typeof targets === 'string' ? JSON.parse(targets) : targets;
  const first = Array.isArray(parsed) ? parsed[0] : null;
  const value = first && typeof first === 'object' ? first.price : first;
  return value == null ? null : String(value);
}

async function fetchReferencePrice(marketData, exchangeCode, symbol, marketType) {
  if (marketType === 'spot' && typeof marketData?.getSpotPrice === 'function') {
    const price = Number(await marketData.getSpotPrice({ exchangeCode, symbol }));
    if (!Number.isFinite(price) || price <= 0) throw new Error('No valid market price was returned');
    return price;
  }
  if (typeof marketData?.getMarketData !== 'function') {
    throw new Error('Market data is unavailable');
  }
  const data = await marketData.getMarketData({
    exchangeCode,
    symbol,
    marketType,
    timeframe: '1m',
    limit: 25,
  });
  const price = Number(data?.overview?.lastPrice);
  if (!Number.isFinite(price) || price <= 0) throw new Error('No valid market price was returned');
  return price;
}

export default createCopyOrchestrationService;