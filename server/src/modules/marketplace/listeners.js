/**
 * SyncExc Server — Marketplace event listeners
 *
 * When a signal is published, kick off the copy orchestration.
 */

export function createMarketplaceListeners({
  events,
  copyOrchestration,
  traderSignalExecution,
  publicationService,
  queries,
  logger,
}) {
  events.subscribe(
    'marketplace.signal_published',
    async (envelope) => {
      const { signalId } = envelope.payload || {};
      if (!signalId) return;
      try {
        // Mirror to the trader's other accounts before subscriber fanout. The
        // source account is excluded by the execution service.
        try {
          await traderSignalExecution.executePublishedSignal({ publishedSignalId: signalId });
        } catch (err) {
          logger.error({ err, signalId }, 'Trader account synchronization failed after publish');
        }
        await copyOrchestration.processPublishedSignal({ publishedSignalId: signalId });
      } catch (err) {
        logger.error({ err, signalId }, 'Signal execution orchestration failed after publish');
      }
    },
    { name: 'marketplace:orchestrate-copy' }
  );

  events.subscribe(
    'execution.order_filled',
    async (envelope) => {
      const { orderId } = envelope.payload || {};
      if (!orderId) return;

      try {
        await traderSignalExecution.handleOrderFilled({ orderId });
        await queries.updateCopyExecutionByOrder?.(orderId, 'filled');
        const existingSignal = await queries.findPublishedSignalBySourceOrderId(orderId);
        if (existingSignal) return;

        const order = await queries.findOrderForAutoPublication(orderId);
        if (!order || !order.average_fill_price || Number(order.average_fill_price) <= 0) return;

        await publicationService.publishSignal({
          userId: order.user_id,
          workspaceId: order.workspace_id,
          providerId: order.provider_id,
          instrument: order.instrument,
          marketType: order.market_type,
          direction: order.side === 'buy' ? 'long' : 'short',
          orderType: order.type === 'limit' ? 'limit' : 'market',
          entryTime: order.created_at,
          entry: String(order.average_fill_price),
          sourceOrderId: order.id,
          sourceAccountId: order.account_id,
        });
      } catch (err) {
        logger.error({ err, orderId }, 'Automatic signal publication failed for terminal fill');
      }
    },
    { name: 'marketplace:auto-publish-terminal-fills' }
  );

  events.subscribe(
    'execution.position_opened',
    async (envelope) => {
      const position = envelope.payload || {};
      if (!position.positionSnapshotId || !position.workspaceId) return;
      try {
        const provider = await queries.findProviderForPositionPublication(position.workspaceId);
        if (!provider) return;
        if (await queries.findPublishedSignalBySourcePositionSnapshotId(position.positionSnapshotId)) {
          return;
        }
        await publicationService.publishSignal({
          userId: provider.user_id,
          workspaceId: provider.workspace_id,
          providerId: provider.id,
          instrument: position.instrument,
          marketType: position.marketType,
          direction: position.direction,
          entryTime: envelope.createdAt || new Date(),
          entry: String(position.entry),
          leverage: position.leverage,
          sourcePositionSnapshotId: position.positionSnapshotId,
          sourceAccountId: position.accountId,
        });
      } catch (err) {
        logger.error(
          { err, positionSnapshotId: position.positionSnapshotId },
          'Automatic marketplace publication failed for exchange position',
        );
      }
    },
    { name: 'marketplace:auto-publish-exchange-positions' },
  );

  for (const [eventType, status] of [
    ['execution.order_rejected', 'rejected'],
    ['execution.order_canceled', 'canceled'],
    ['execution.order_partially_filled', 'partially_filled'],
  ]) {
    events.subscribe(
      eventType,
      async (envelope) => {
        const { orderId } = envelope.payload || {};
        if (!orderId) return;
        try {
          const reconciledStatus = envelope.payload?.status || status;
          await traderSignalExecution.handleOrderStatus({ orderId, status: reconciledStatus });
          await queries.updateCopyExecutionByOrder?.(
            orderId,
            reconciledStatus,
            envelope.payload?.errorMessage || envelope.payload?.reason || null,
          );
        } catch (err) {
          logger.error({ err, orderId, status }, 'Could not update trader signal execution status');
        }
      },
      { name: `marketplace:trader-signal-${status}` },
    );
  }

  events.subscribe(
    'execution.closed_trade_recorded',
    async (envelope) => {
      const trade = envelope.payload || {};
      try {
        const matchedExistingSignal = await traderSignalExecution.handleClosedTrade(trade);
        if (matchedExistingSignal || !trade.workspaceId) return;

        const provider = await queries.findProviderForPositionPublication(trade.workspaceId);
        if (!provider) return;
        const signal = await publicationService.publishClosedTrade({
          userId: provider.user_id,
          workspaceId: provider.workspace_id,
          providerId: provider.id,
          trade,
        });
        if (signal?.id) {
          await traderSignalExecution.recordClosedTradeSignal({ signalId: signal.id, trade });
        }
      } catch (err) {
        logger.error(
          { err, closedTradeId: trade.closedTradeId },
          'Could not publish or attribute the closed exchange trade',
        );
      }
    },
    { name: 'marketplace:exact-signal-performance' },
  );

  logger.debug('Marketplace event listeners registered');

  return {
    async shutdown() {},
  };
}

export default createMarketplaceListeners;