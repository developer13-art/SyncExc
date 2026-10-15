/**
 * SyncExc Server — Signals event listeners
 */

export function createSignalsListeners({ events, ingestion, extraction, logger }) {
  // When a message is received (via outbox), kick off extraction
  events.subscribe(
    'signal.message_received',
    async (envelope) => {
      const { messageId } = envelope.payload || {};
      if (!messageId) return;
      try {
        await extraction.extractFromMessage({ messageId });
      } catch (err) {
        logger.error({ err, messageId }, 'Extraction failed');
      }
    },
    { name: 'signals:extract-on-ingest' }
  );

  logger.debug('Signals event listeners registered');

  return {
    async shutdown() {},
  };
}

export default createSignalsListeners;