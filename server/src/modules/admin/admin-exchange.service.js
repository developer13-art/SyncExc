/**
 * SyncExc Server — Admin exchange service
 */

export function createAdminExchangeService({ db, queries, events, audit, logger }) {
  async function listExchanges() {
    const result = await db.query(
      `
      SELECT e.*, 
        (SELECT count(*) FROM exchange_connections WHERE exchange_code = e.exchange_code AND status = 'active')::int AS active_connections
      FROM exchange_registry e
      ORDER BY e.display_name ASC
      `
    );
    return result.rows;
  }

  async function getExchangeHealth({ exchangeCode, actorId }) {
    const health = await db.query(
      `
      SELECT h.state, count(*)::int AS count
      FROM exchange_connection_health h
      JOIN exchange_connections c ON c.id = h.connection_id
      WHERE c.exchange_code = $1
      GROUP BY h.state
      `,
      [exchangeCode]
    );

    const incidents = await db.query(
      `
      SELECT * FROM exchange_adapter_incidents
      WHERE exchange_code = $1 AND resolved_at IS NULL
      ORDER BY started_at DESC
      `,
      [exchangeCode]
    );

    const metrics = await db.query(
      `
      SELECT
        count(*)::int AS request_count,
        COALESCE(avg(latency_ms), 0)::int AS avg_latency_ms,
        count(*) FILTER (WHERE error_class IS NOT NULL)::int AS error_count
      FROM exchange_request_metrics
      WHERE exchange_code = $1 AND recorded_at >= now() - interval '24 hours'
      `,
      [exchangeCode]
    );

    await audit.write({
      actorId,
      action: 'exchange.health_viewed',
      targetResource: 'exchange',
      targetId: exchangeCode,
    });

    return {
      health: health.rows,
      incidents: incidents.rows,
      metrics24h: metrics.rows[0],
    };
  }

  async function restrictCapability({ exchangeCode, capabilityKey, actorId, reason, expiresAt }) {
    return db.tx(async (tx) => {
      const before = await tx.query(
        `
        SELECT * FROM exchange_capability_support
        WHERE exchange_id = (SELECT id FROM exchange_registry WHERE exchange_code = $1)
          AND capability_key = $2
        `,
        [exchangeCode, capabilityKey]
      );

      const result = await tx.query(
        `
        UPDATE exchange_capability_support
        SET supported = false, limitations = $3, last_validated_at = now()
        WHERE exchange_id = (SELECT id FROM exchange_registry WHERE exchange_code = $1)
          AND capability_key = $2
        RETURNING *
        `,
        [exchangeCode, capabilityKey, JSON.stringify({ reason, expiresAt, restrictedBy: actorId })]
      );

      await audit.write({
        actorId,
        action: 'exchange.capability_restricted',
        targetResource: 'exchange',
        targetId: exchangeCode,
        before: before.rows[0],
        after: result.rows[0],
        reason,
      });

      await events.publish(
        tx,
        'admin.exchange_restricted',
        { exchangeCode, capabilityKey, reason, expiresAt },
        {
          actorId,
          resourceType: 'exchange',
          resourceId: exchangeCode,
        }
      );

      return result.rows[0];
    });
  }

  async function listAdapterIncidents({ exchangeCode, resolved = false } = {}) {
    const params = [resolved];
    let exchangeClause = '';
    if (exchangeCode) {
      params.push(exchangeCode);
      exchangeClause = `AND exchange_code = $${params.length}`;
    }
    const result = await db.query(
      `
      SELECT * FROM exchange_adapter_incidents
      WHERE resolved_at IS ${resolved ? 'NULL' : 'NOT NULL'} ${exchangeClause}
      ORDER BY started_at DESC
      `,
      params
    );
    return result.rows;
  }

  return {
    listExchanges,
    getExchangeHealth,
    restrictCapability,
    listAdapterIncidents,
  };
}

export default createAdminExchangeService;