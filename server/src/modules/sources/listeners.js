/**
 * SyncExc Server — Sources event listeners
 *
 * Subscribes to internal events that update source metrics.
 */

export function createSourcesListeners({ events, sourcesQueries, healthService, qualityService, logger }) {
  // Record ingested messages for quality scoring
  events.subscribe(
    'signal.message_received',
    async (envelope) => {
      const { sourceId, valid = true, duplicate = false } = envelope.payload || {};
      if (!sourceId) return;
      try {
        await qualityService.recordMessageIngested({ sourceId, valid, duplicate });
      } catch (err) {
        logger.error({ err, sourceId }, 'Failed to record source message');
      }
    },
    { name: 'sources:record-message' }
  );

  logger.debug('Sources event listeners registered');

  return {
    async shutdown() {},
  };
}

export default createSourcesListeners;