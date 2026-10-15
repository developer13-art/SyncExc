/**
 * SyncExc Server — Admin support service
 */

export function createAdminSupportService({ db, queries, support, audit, logger }) {
  async function listQueues() {
    const result = await db.query(
      `
      SELECT q.*, 
        (SELECT count(*) FROM support_tickets WHERE queue_id = q.id AND status NOT IN ('resolved', 'closed', 'canceled'))::int AS open_tickets
      FROM support_queues q
      ORDER BY q.name ASC
      `
    );
    return result.rows;
  }

  async function listQueueMembers({ queueId }) {
    const result = await db.query(
      `
      SELECT m.*, u.email AS user_email
      FROM support_queue_members m
      JOIN users u ON u.id = m.user_id
      WHERE m.queue_id = $1
      `,
      [queueId]
    );
    return result.rows;
  }

  async function addQueueMember({ queueId, userId, role, actorId }) {
    return db.tx(async (tx) => {
      const result = await tx.query(
        `
        INSERT INTO support_queue_members (queue_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (queue_id, user_id) DO UPDATE SET role = EXCLUDED.role
        RETURNING *
        `,
        [queueId, userId, role || 'agent']
      );

      await audit.write({
        actorId,
        action: 'support_queue.member_added',
        targetResource: 'support_queue',
        targetId: queueId,
        after: { userId, role },
      });

      return result.rows[0];
    });
  }

  async function removeQueueMember({ queueId, userId, actorId }) {
    return db.tx(async (tx) => {
      await tx.query(
        `DELETE FROM support_queue_members WHERE queue_id = $1 AND user_id = $2`,
        [queueId, userId]
      );

      await audit.write({
        actorId,
        action: 'support_queue.member_removed',
        targetResource: 'support_queue',
        targetId: queueId,
        after: { userId },
      });

      return { ok: true };
    });
  }

  async function getMetrics({ since }) {
    return support.metrics.getDashboardMetrics({ since });
  }

  return {
    listQueues,
    listQueueMembers,
    addQueueMember,
    removeQueueMember,
    getMetrics,
  };
}

export default createAdminSupportService;