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
        // The publisher finishes the trader's own account execution before it
        // emits this event. Copy fanout therefore starts only after that baseline.
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
        });
      } catch (err) {
        logger.error({ err, orderId }, 'Automatic signal publication failed for terminal fill');
      }
    },
    { name: 'marketplace:auto-publish-terminal-fills' }
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
          await traderSignalExecution.handleOrderStatus({ orderId, status });
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
      try {
        await traderSignalExecution.handleClosedTrade(envelope.payload || {});
      } catch (err) {
        logger.error(
          { err, closedTradeId: envelope.payload?.closedTradeId },
          'Could not attribute closed-trade performance to a trader signal',
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