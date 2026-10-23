/**
 * SyncExc Server — Marketplace event listeners
 *
 * When a signal is published, kick off the copy orchestration.
 */

export function createMarketplaceListeners({
  events,
  copyOrchestration,
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
        await copyOrchestration.processPublishedSignal({ publishedSignalId: signalId });
      } catch (err) {
        logger.error({ err, signalId }, 'Copy orchestration failed after publish');
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

  logger.debug('Marketplace event listeners registered');

  return {
    async shutdown() {},
  };
}

export default createMarketplaceListeners;