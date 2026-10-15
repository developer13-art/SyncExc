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

export function createCopyOrchestrationService({
  db,
  queries,
  subscriptionService,
  copyConfigurationService,
  risk,
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
          type: 'market',
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
    } else if (config.execution_mode === 'confirm_before_execution') {
      outcome = COPY_PROCESSING_OUTCOME.HELD;
    } else {
      outcome = COPY_PROCESSING_OUTCOME.ELIGIBLE;
    }

    // Record the processing
    const idempotencyKey = fnv1aHash(
      `copy:${signal.id}:${config.id}:${destination.id}:${config.current_version}`
    );

    const record = await db.tx(async (tx) => {
      const r = await queries.insertCopyProcessingRecord(tx, {
        publishedSignalId: signal.id,
        configId: config.id,
        subscriberUserId: config.workspace_id, // Could be user-scoped
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
        subscriberUserId: config.workspace_id,
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

  async function listRecordsForWorkspace(workspaceId, { limit }) {
    return queries.listCopyProcessingRecordsForWorkspace(workspaceId, { limit });
  }

  return {
    processPublishedSignal,
    listRecordsForWorkspace,
  };
}

export default createCopyOrchestrationService;