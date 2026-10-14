/**
 * SyncExc Server — Postgres connection pool
 *
 * Creates a single pg.Pool shared by the whole process. Configures
 * statement timeout, idle timeout, and application name. Logs connection
 * lifecycle events. Retries initial connection if Postgres isn't ready yet.
 */

import pg from 'pg';
import config from '../config.js';
import { createLogger } from '../lib/logger.js';
import { sleep } from '@syncexc/shared';

const logger = createLogger({ component: 'database:pool' });

// Parse numeric types as numbers where safe.
pg.types.setTypeParser(pg.types.builtins.INT8, (val) => {
  // INT8 (bigint) — return as string to preserve precision beyond 2^53.
  return val;
});
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (val) => {
  // NUMERIC — return as string. Never coerce to JS number for financial data.
  return val;
});
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (val) => {
  // Preserve as Date for ergonomics; ISO conversion happens in serializers.
  return val === null ? null : new Date(val);
});
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (val) => {
  return val === null ? null : new Date(`${val}Z`);
});

export async function createPool() {
  const pool = new pg.Pool({
    connectionString: config.database.url,
    min: config.database.poolMin,
    max: config.database.poolMax,
    statement_timeout: config.database.statementTimeout,
    idle_in_transaction_session_timeout: 60000,
    idleTimeoutMillis: config.database.idleTimeout,
    connectionTimeoutMillis: 10000,
    application_name: 'syncexc-server',
  });

  pool.on('connect', (client) => {
    logger.debug('New database connection established');
    client.query("SET TIME ZONE 'UTC'").catch(() => {});
    client.query("SET application_name = 'syncexc-server'").catch(() => {});
  });

  pool.on('acquire', () => {
    logger.trace('Client acquired from pool');
  });

  pool.on('remove', () => {
    logger.debug('Client removed from pool');
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected database pool error');
  });

  // Retry initial connection — Postgres may not be ready yet in some deploys.
  const maxAttempts = 10;
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }
      logger.info(
        { poolMin: config.database.poolMin, poolMax: config.database.poolMax },
        'Database pool established'
      );
      return pool;
    } catch (err) {
      attempt += 1;
      if (attempt >= maxAttempts) {
        logger.error({ err, attempts: attempt }, 'Failed to connect to database');
        throw err;
      }
      const delay = Math.min(1000 * attempt, 5000);
      logger.warn(
        { attempt, delay, err: err.message },
        'Database connection failed; retrying'
      );
      await sleep(delay);
    }
  }

  return pool;
}

export default createPool;