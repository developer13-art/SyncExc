/**
 * SyncExc Server — Database layer
 *
 * Initializes the PostgreSQL connection pool, provides query helpers, and
 * exposes transaction management.
 *
 * Usage:
 *   const db = await initDatabase();
 *   const result = await db.query('SELECT ...');
 *   await db.tx(async (tx) => { ... });
 */

import { createPool } from './connection.js';
import { createTransactionRunner } from './transaction.js';
import { createHealthCheck } from './health-check.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger({ component: 'database' });

export async function initDatabase() {
  const pool = await createPool();

  const db = {
    pool,

    /**
     * Run a parameterized query.
     */
    async query(text, params) {
      const start = Date.now();
      try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 500) {
          logger.warn(
            { duration, rows: result.rowCount, sql: text.slice(0, 200) },
            'Slow query'
          );
        }
        return result;
      } catch (err) {
        logger.error(
          { err, sql: text.slice(0, 500), params: params?.length },
          'Query failed'
        );
        throw err;
      }
    },

    /**
     * Get a client for a manual transaction. Caller MUST release.
     */
    async getClient() {
      return pool.connect();
    },

    /**
     * Run a transaction.
     */
    async tx(fn) {
      return createTransactionRunner(pool)(fn);
    },

    /**
     * Health check.
     */
    health: createHealthCheck(pool),

    /**
     * Close the pool gracefully.
     */
    async close() {
      logger.info('Closing database pool');
      await pool.end();
    },
  };

  // Verify connectivity at boot.
  const health = await db.health();
  if (!health.ok) {
    throw new Error(`Database health check failed: ${health.error}`);
  }
  logger.info(
    { latencyMs: health.latencyMs, version: health.version },
    'Database ready'
  );

  return db;
}

export default initDatabase;