/**
 * SyncExc Server — Marketplace event listeners
 *
 * When a signal is published, kick off the copy orchestration.
 */

export function createMarketplaceListeners({ events, copyOrchestration, logger }) {
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

  logger.debug('Marketplace event listeners registered');

  return {
    async shutdown() {},
  };
}

export default createMarketplaceListeners;