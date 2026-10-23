/**
 * SyncExc Server — Signal publication service
 */

import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';
import { fnv1aHash } from '@syncexc/shared';

export function createPublicationService({ db, queries, events, disclosureService, logger }) {
  async function publishSignal({
    userId,
    workspaceId,
    providerId,
    instrument,
    marketType,
    direction,
    orderType = 'market',
    entryTime,
    entry,
    entryRange,
    stopLoss,
    targets,
    leverage,
    validUntil,
    disclosures,
    sourceEvidence,
    sourceOrderId,
  }) {
    const provider = await queries.findProviderById(providerId);
    if (!provider) throw new NotFoundError('Provider');
    if (provider.user_id !== userId || provider.workspace_id !== workspaceId) throw new NotFoundError('Provider');
    if (provider.moderation_state !== 'approved') {
      throw new ConflictError('Provider is not approved to publish', 'PROVIDER_NOT_APPROVED');
    }

    if (!instrument || !marketType || !direction || !orderType) {
      throw new ValidationError('instrument, market type, direction, and order type are required');
    }
    if (!['long', 'short'].includes(direction)) {
      throw new ValidationError('direction must be long or short');
    }
    if (!['spot', 'futures', 'perpetual'].includes(marketType)) {
      throw new ValidationError('marketType must be spot, futures, or perpetual');
    }
    if (!['market', 'limit'].includes(orderType)) {
      throw new ValidationError('orderType must be market or limit');
    }

    if (!sourceOrderId) {
      const stop = Number(stopLoss);
      const takeProfits = Array.isArray(targets) ? targets.map(Number) : [];
      if (!Number.isFinite(stop) || stop <= 0) {
        throw new ValidationError('A positive stop loss is required');
      }
      if (
        takeProfits.length === 0 ||
        takeProfits.some((target) => !Number.isFinite(target) || target <= 0)
      ) {
        throw new ValidationError('At least one positive take-profit target is required');
      }
      if (orderType === 'limit' && (!Number.isFinite(Number(entry)) || Number(entry) <= 0)) {
        throw new ValidationError('Limit orders require a positive entry price');
      }
      if (orderType === 'market' && (entry != null || entryRange != null)) {
        throw new ValidationError('Market orders must not include an entry price');
      }
      const entryPrice = orderType === 'limit' ? Number(entry) : null;
      const invalidLevelOrder = direction === 'long'
        ? takeProfits.some((target) => target <= stop) ||
          (entryPrice !== null &&
            (stop >= entryPrice || takeProfits.some((target) => target <= entryPrice)))
        : takeProfits.some((target) => target >= stop) ||
          (entryPrice !== null &&
            (stop <= entryPrice || takeProfits.some((target) => target >= entryPrice)));
      if (invalidLevelOrder) {
        throw new ValidationError('Stop loss, entry, and take profit must match the signal direction');
      }
      if (entryRange != null) {
        throw new ValidationError('Entry ranges are not supported when publishing a signal');
      }
    }

    return db.tx(async (tx) => {
      const signal = await queries.insertPublishedSignal(tx, {
        providerId,
        instrument,
        marketType,
        direction,
        orderType,
        entryTime,
        entry,
        entryRange,
        stopLoss,
        leverage,
        validUntil,
        sourceOrderId,
        metadata: { sourceEvidence, disclosures },
      });

      // Snapshot version 1
      await queries.insertPublishedSignalVersion(tx, {
        signalId: signal.id,
        version: 1,
        snapshot: {
          ...signal,
          targets: targets || [],
          disclosures: disclosures || null,
        },
        changeReason: 'initial',
      });

      // Publication record
      await queries.insertPublication(tx, {
        signalId: signal.id,
        channel: 'marketplace',
        visibility: 'subscribers',
      });

      // Update status to published
      const publishedSignal = await queries.updatePublishedSignal(signal.id, { status: 'published' }, false, tx);

      await events.publish(
        tx,
        'marketplace.signal_published',
        {
          signalId: signal.id,
          providerId,
          instrument,
          direction,
        },
        {
          actorId: userId,
          resourceType: 'published_signal',
          resourceId: signal.id,
        }
      );

      return publishedSignal;
    });
  }

  async function updateSignal({
    userId,
    workspaceId,
    signalId,
    updates,
    changeReason,
  }) {
    const signal = await queries.findPublishedSignalById(signalId);
    if (!signal) throw new NotFoundError('Signal');
    const provider = await queries.findProviderById(signal.provider_id);
    if (!provider || provider.user_id !== userId || provider.workspace_id !== workspaceId) throw new NotFoundError('Signal');
    if (signal.status === 'cancelled' || signal.status === 'closed') {
      throw new ConflictError('Signal cannot be updated in its current state', 'INVALID_STATE');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updatePublishedSignal(signalId, updates, true, tx);

      await queries.insertPublishedSignalVersion(tx, {
        signalId,
        version: signal.current_version + 1,
        snapshot: updated,
        changeReason: changeReason || 'update',
      });

      await events.publish(
        tx,
        'marketplace.signal_updated',
        {
          signalId,
          providerId: signal.provider_id,
          changes: updates,
        },
        {
          actorId: userId,
          resourceType: 'published_signal',
          resourceId: signalId,
        }
      );

      return updated;
    });
  }

  async function cancelSignal({ userId, workspaceId, signalId, reason }) {
    const signal = await queries.findPublishedSignalById(signalId);
    if (!signal) throw new NotFoundError('Signal');
    const provider = await queries.findProviderById(signal.provider_id);
    if (!provider || provider.user_id !== userId || provider.workspace_id !== workspaceId) throw new NotFoundError('Signal');

    return db.tx(async (tx) => {
      const updated = await queries.updatePublishedSignal(signalId, { status: 'cancelled' }, true, tx);

      await queries.insertPublishedSignalVersion(tx, {
        signalId,
        version: signal.current_version + 1,
        snapshot: updated,
        changeReason: `cancelled: ${reason}`,
      });

      await events.publish(
        tx,
        'marketplace.signal_cancelled',
        { signalId, reason },
        {
          actorId: userId,
          resourceType: 'published_signal',
          resourceId: signalId,
        }
      );

      return updated;
    });
  }

  async function listSignals({
    providerId,
    status,
    publicOnly = false,
    includeTraderExecution = false,
    limit,
    cursor,
  }) {
    return queries.listPublishedSignals({
      providerId,
      status,
      publicOnly,
      includeTraderExecution,
      limit,
      cursor,
    });
  }

  async function getSignal(signalId) {
    const signal = await queries.findPublishedSignalById(signalId);
    if (!signal) throw new NotFoundError('Signal');
    return signal;
  }

  return {
    publishSignal,
    updateSignal,
    cancelSignal,
    listSignals,
    getSignal,
  };
}

export default createPublicationService;