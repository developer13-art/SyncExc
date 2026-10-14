/**
 * SyncExc Server — Circuit breaker service
 */

export function createCircuitBreakerService({ db, queries, emergencyPause, events, logger }) {
  /**
   * Trigger a circuit breaker for a given scope and reason.
   */
  async function trigger({ workspaceId, scopeType, scopeId, triggerType, reason, metadata }) {
    return db.tx(async (tx) => {
      const breaker = await queries.upsertCircuitBreaker(tx, {
        workspaceId,
        scopeType,
        scopeId,
        triggerType,
        state: 'active',
        config: metadata,
      });

      if (breaker) {
        await queries.insertCircuitBreakerEvent(tx, {
          breakerId: breaker.id,
          eventType: 'activated',
          reason,
          metadata,
        });
      }

      await events.publish(
        tx,
        'risk.circuit_breaker_activated',
        { triggerType, scopeType, scopeId, reason },
        {
          workspaceId,
          resourceType: 'circuit_breaker',
          resourceId: breaker?.id || 'unknown',
        }
      );

      return breaker;
    }).then(async (result) => {
      // Circuit breakers trigger an emergency pause at the same scope
      if (result) {
        await emergencyPause.request({
          userId: null,
          workspaceId,
          scope: scopeType,
          scopeRef: scopeId,
          reason: `Circuit breaker: ${triggerType} — ${reason}`,
        });
      }
      return result;
    });
  }

  async function listActive({ workspaceId }) {
    return queries.listActiveCircuitBreakers(workspaceId);
  }

  async function reset({ breakerId, userId, reason }) {
    await db.query(
      `UPDATE risk_circuit_breakers SET state = 'inactive', updated_at = now() WHERE id = $1`,
      [breakerId]
    );

    await db.query(
      `
      INSERT INTO risk_circuit_breaker_events (breaker_id, event_type, reason)
      VALUES ($1, 'reset', $2)
      `,
      [breakerId, reason]
    );

    logger.info({ breakerId, userId }, 'Circuit breaker reset');
    return { ok: true };
  }

  return {
    trigger,
    listActive,
    reset,
  };
}

export default createCircuitBreakerService;