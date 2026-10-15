/**
 * SyncExc Server — Queue service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createQueueService({ db, queries, logger }) {
  async function listQueues() {
    return queries.listQueues();
  }

  async function getQueue(queueId) {
    const queue = await queries.findQueueById(queueId);
    if (!queue) throw new NotFoundError('Queue');
    return queue;
  }

  async function listQueueMembers({ queueId }) {
    return queries.listQueueMembers(queueId);
  }

  async function addQueueMember({ queueId, userId, role }) {
    return db.tx(async (tx) => {
      return queries.insertQueueMember(tx, {
        queueId,
        userId,
        role,
      });
    });
  }

  /**
   * Get the queues an agent is a member of.
   */
  async function listQueuesForUser(userId) {
    const result = await db.query(
      `
      SELECT q.* FROM support_queues q
      JOIN support_queue_members m ON m.queue_id = q.id
      WHERE m.user_id = $1
      ORDER BY q.name ASC
      `,
      [userId]
    );
    return result.rows;
  }

  return {
    listQueues,
    getQueue,
    listQueueMembers,
    addQueueMember,
    listQueuesForUser,
  };
}

export default createQueueService;