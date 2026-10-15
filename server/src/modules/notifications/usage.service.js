/**
 * SyncExc Server — Usage service
 */

export function createUsageService({ db, queries, logger }) {
  async function record({ userId, workspaceId, channel, amount = 1 }) {
    try {
      await db.tx(async (tx) => {
        await queries.insertUsageEvent(tx, {
          userId,
          workspaceId,
          channel,
          amount,
        });
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to record notification usage');
    }
  }

  return {
    record,
  };
}

export default createUsageService;