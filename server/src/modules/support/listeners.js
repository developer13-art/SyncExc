/**
 * SyncExc Server — Support event listeners
 */

export function createSupportListeners({ events, ticketService, slaService, logger }) {
  // Auto-record first response when an agent posts a reply
  events.subscribe(
    'support.ticket_assigned',
    async (envelope) => {
      const { ticketId, firstResponseAt } = envelope.payload || {};
      if (firstResponseAt) {
        try {
          await slaService.recordFirstResponse(ticketId);
        } catch (err) {
          logger.error({ err, ticketId }, 'Failed to record first response');
        }
      }
    },
    { name: 'support:record-first-response' }
  );

  logger.debug('Support event listeners registered');

  return {
    async shutdown() {},
  };
}

export default createSupportListeners;