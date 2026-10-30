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
    sourcePositionSnapshotId,
    sourceAccountId,
    executionAccountIds,
    executionAmount,
    beforePublish,
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
    const exchangeSourced = sourceOrderId || sourcePositionSnapshotId;
    if (!exchangeSourced && beforePublish && (!Array.isArray(executionAccountIds) ||
      executionAccountIds.length === 0 ||
      !Number.isFinite(Number(executionAmount)) ||
      Number(executionAmount) <= 0)) {
      throw new ValidationError('Select at least one trader account and enter a positive execution amount');
    }

    if (!exchangeSourced) {
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

    const signal = await db.tx(async (tx) => {
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
        sourcePositionSnapshotId,
        sourceAccountId,
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

      return {
        ...signal,
        user_id: userId,
        workspace_id: workspaceId,
        targets: targets || [],
      };
    });

    // Manual publications execute the trader's selected accounts before their
    // signal becomes visible to subscribers or enters the copy-trading fanout.
    if (beforePublish && !exchangeSourced) {
      await beforePublish({
        signal,
        accountIds: executionAccountIds,
        amount: String(executionAmount),
      });
    }

    return db.tx(async (tx) => {
      const publishedSignal = await queries.updatePublishedSignal(
        signal.id,
        { status: 'published' },
        false,
        tx,
      );
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

  async function publishClosedTrade({ userId, workspaceId, providerId, trade }) {
    const provider = await queries.findProviderById(providerId);
    if (!provider || provider.user_id !== userId || provider.workspace_id !== workspaceId) {
      throw new NotFoundError('Provider');
    }
    if (provider.moderation_state !== 'approved' || provider.visibility !== 'public') {
      throw new ConflictError('Provider is not approved for public publication', 'PROVIDER_NOT_APPROVED');
    }
    if (
      !trade?.closedTradeId ||
      !trade.instrument ||
      !['long', 'short'].includes(trade.side) ||
      !Number.isFinite(Number(trade.realizedPnl))
    ) {
      throw new ValidationError('A closed exchange trade must include its ID, instrument, direction, and realized PnL');
    }
    const marketType = trade.marketType || 'perpetual';
    if (!['spot', 'futures', 'perpetual'].includes(marketType)) {
      throw new ValidationError('marketType must be spot, futures, or perpetual');
    }
    const closedAt = trade.closedAt instanceof Date ? trade.closedAt : new Date(trade.closedAt);
    if (Number.isNaN(closedAt.getTime())) {
      throw new ValidationError('A closed exchange trade must include a valid close time');
    }
    const entryCandidate = Number(trade.entryPrice);
    const entry = Number.isFinite(entryCandidate) && entryCandidate > 0
      ? String(trade.entryPrice)
      : null;
    const entryTimeCandidate = trade.entryTime
      ? (/^\d+$/.test(String(trade.entryTime))
          ? new Date(Number(trade.entryTime))
          : new Date(trade.entryTime))
      : closedAt;
    const entryTime = Number.isNaN(entryTimeCandidate.getTime()) ? closedAt : entryTimeCandidate;
    const existing = await queries.findPublishedSignalBySourceClosedTradeId(trade.closedTradeId);
    if (existing) return existing;

    return db.tx(async (tx) => {
      const inserted = await queries.insertPublishedSignal(tx, {
        providerId,
        instrument: trade.instrument,
        marketType,
        direction: trade.side,
        orderType: 'market',
        entryTime,
        entry,
        stopLoss: null,
        leverage: trade.leverage || null,
        status: 'closed',
        sourceAccountId: trade.accountId,
        sourceClosedTradeId: trade.closedTradeId,
        realizedPnl: String(trade.realizedPnl),
        pnlAsset: trade.pnlAsset || null,
        closedAt,
        metadata: {
          sourceEvidence: {
            type: 'exchange_closed_trade',
            exchangeCode: trade.exchangeCode || null,
          },
        },
      });
      if (!inserted) {
        return queries.findPublishedSignalBySourceClosedTradeId(trade.closedTradeId, tx);
      }

      await queries.insertPublishedSignalVersion(tx, {
        signalId: inserted.id,
        version: 1,
        snapshot: {
          ...inserted,
          targets: [],
        },
        changeReason: 'initial',
      });
      await queries.insertPublication(tx, {
        signalId: inserted.id,
        channel: 'marketplace',
        visibility: 'subscribers',
      });
      return {
        ...inserted,
        user_id: userId,
        workspace_id: workspaceId,
        targets: [],
      };
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
    publishClosedTrade,
    updateSignal,
    cancelSignal,
    listSignals,
    getSignal,
  };
}

export default createPublicationService;