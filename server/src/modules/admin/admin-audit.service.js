/**
 * SyncExc Server — Admin audit service
 */

export function createAdminAuditService({ db, queries, logger }) {
  async function write({
    actorId,
    actorRoleRef,
    workspaceId,
    action,
    targetResource,
    targetId,
    reason,
    before,
    after,
    approvalRef,
    correlationId,
    ipAddress,
    userAgent,
    outcome,
  }) {
    try {
      return await db.tx(async (tx) => {
        return queries.insertAuditEvent(tx, {
          actorId,
          actorRoleRef,
          workspaceId,
          action,
          targetResource,
          targetId,
          reason,
          before,
          after,
          approvalRef,
          correlationId,
          ipAddress,
          userAgent,
          outcome: outcome || 'success',
        });
      });
    } catch (err) {
      logger.error({ err, action, targetResource }, 'Failed to write admin audit event');
      throw err;
    }
  }

  async function search(filters) {
    return queries.searchAuditEvents(filters);
  }

  return {
    write,
    search,
  };
}

export default createAdminAuditService;