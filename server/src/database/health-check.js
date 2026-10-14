/**
 * SyncExc Server — Database health check
 *
 * Executes a fast read against the pool. Reports latency and server version.
 * Used by readiness probes and monitoring.
 */

export function createHealthCheck(pool) {
  return async function health() {
    const started = Date.now();
    try {
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT version() AS version, current_database() AS db');
        return {
          ok: true,
          latencyMs: Date.now() - started,
          version: result.rows[0].version.split(' ')[1],
          database: result.rows[0].db,
          poolTotal: pool.totalCount,
          poolIdle: pool.idleCount,
          poolWaiting: pool.waitingCount,
        };
      } finally {
        client.release();
      }
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: err.message,
      };
    }
  };
}

export default createHealthCheck;