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
import { ConflictError, NotFoundError } from '../../lib/errors.js';

export function createCopyOrchestrationService({
  db,
  queries,
  subscriptionService,
  copyConfigurationService,
  risk,
  terminal,
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

  async function processDestination({ config, signal, destination }) {
    // Skip if the destination connection is not active
    if (destination.connection_status !== 'active') {
      await recordSkip({
        config,
        signal,
        destination,
        reason: COPY_SKIP_REASON.DESTINATION_DISCONNECTED,
        message: `Connection status: ${destination.connection_status}`,
      });
      return;
    }

    // Compute the sizing
    let allocation;
    try {
      allocation = computeAllocation({
        sizingRule: config.sizing_rule,
        signal,
      });
    } catch (err) {
      await recordSkip({
        config,
        signal,
        destination,
        reason: COPY_SKIP_REASON.INVALID_ALLOCATION,
        message: err.message,
      });
      return;
    }

    if (!allocation || Number(allocation.quantity) <= 0) {
      await recordSkip({
        config,
        signal,
        destination,
        reason: COPY_SKIP_REASON.INVALID_ALLOCATION,
        message: 'Sizing produced invalid quantity',
      });
      return;
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
          price: signal.entry,
        },
      });
    } catch (err) {
      await recordSkip({
        config,
        signal,
        destination,
        reason: COPY_SKIP_REASON.RISK_LIMIT_EXCEEDED,
        message: `Risk evaluation failed: ${err.message}`,
      });
      return;
    }

    if (riskDecision.outcome === 'blocked') {
      await recordSkip({
        config,
        signal,
        destination,
        reason: COPY_SKIP_REASON.RISK_LIMIT_EXCEEDED,
        message: `Blocked: ${riskDecision.reasonCode}`,
      });
      return;
    }

    // Determine outcome based on execution mode
    let outcome;
    if (config.execution_mode === 'monitor_only') {
      outcome = COPY_PROCESSING_OUTCOME.SKIPPED;
    } else {
      outcome = COPY_PROCESSING_OUTCOME.HELD;
    }

    // Record the processing
    const idempotencyKey = fnv1aHash(
      `copy:${signal.id}:${config.id}:${destination.id}:${config.current_version}`
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
            ...(signal.order_type === 'limit' ? { price: signal.entry } : {}),
            idempotencyKey: fnv1aHash(`copy-submit:${signal.id}:${config.id}:${destination.id}:${config.current_version}`),
          },
          idempotencyKey: fnv1aHash(`copy-intent:${signal.id}:${config.id}:${destination.id}:${config.current_version}`),
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

  function computeAllocation({ sizingRule, signal }) {
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
        if (!signal.entry) throw new Error('Signal has no entry price for percentage sizing');
        const percentage = Number(config?.percentage || 0);
        const accountBase = Number(config?.accountBase || 1000);
        const quantity = (accountBase * (percentage / 100)) / Number(signal.entry);
        return {
          type,
          quantity: String(quantity),
          reasoning: `${percentage}% of ${accountBase} at ${signal.entry}`,
        };
      }

      case 'provider_relative':
      case 'user_defined':
      default:
        throw new Error(`Unsupported sizing rule: ${type}`);
    }
  }

  async function recordSkip({ config, signal, destination, reason, message }) {
    const idempotencyKey = fnv1aHash(
      `copy-skip:${signal.id}:${config.id}:${destination?.id || 'none'}:${reason}`
    );

    await db.tx(async (tx) => {
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

      if (!record) return;

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
    });
  }

  async function confirmRecord({ userId, workspaceId, recordId }) {
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

      if (result.order?.status === 'rejected') {
        await markCopyRecordFailed(record, 'rejected', 'execution_rejected');
        return { status: 'rejected', orderId: result.order.id };
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

  async function markCopyRecordFailed(record, intentStatus, reason) {
    await db.tx(async (tx) => {
      await queries.updateCopyExecutionIntent(record.copy_intent_id, { status: intentStatus }, tx);
      await queries.updateCopyProcessingRecord(record.id, {
        outcome: COPY_PROCESSING_OUTCOME.FAILED,
        skipReason: reason,
      }, tx);
      await queries.updateCopyDestinationResult(record.id, {
        outcome: COPY_PROCESSING_OUTCOME.FAILED,
        skipReason: reason,
      }, tx);
    });
  }

  async function listRecordsForWorkspace(workspaceId, { limit }) {
    return queries.listCopyProcessingRecordsForWorkspace(workspaceId, { limit });
  }

  return {
    processPublishedSignal,
    confirmRecord,
    listRecordsForWorkspace,
  };
}

export default createCopyOrchestrationService;