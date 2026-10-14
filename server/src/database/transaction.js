/**
 * SyncExc Server — Transaction runner
 *
 * Wraps pg.Pool's transaction pattern with:
 *   - automatic BEGIN/COMMIT/ROLLBACK
 *   - savepoint-free retry on serialization failures (40001)
 *   - deadlock retry (40P01)
 *   - client release guarantee
 *
 * Isolation level defaults to READ COMMITTED. Callers can request higher
 * isolation via the second argument.
 */

import { createLogger } from '../lib/logger.js';
import { sleep } from '@syncexc/shared';

const logger = createLogger({ component: 'database:tx' });

const RETRYABLE_CODES = new Set([
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '55P03', // lock_not_available
]);

export function createTransactionRunner(pool) {
  return async function runTransaction(fn, { isolationLevel = null, maxAttempts = 3 } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (isolationLevel) {
          await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
        }

        const tx = {
          query: (text, params) => client.query(text, params),
          getClient: () => client,
        };

        const result = await fn(tx);

        await client.query('COMMIT');
        client.release();
        return result;
      } catch (err) {
        // Ensure rollback happens even if BEGIN failed.
        try {
          await client.query('ROLLBACK');
        } catch (rollbackErr) {
          logger.error({ err: rollbackErr }, 'Rollback failed');
        }
        client.release();

        lastError = err;

        if (RETRYABLE_CODES.has(err.code) && attempt < maxAttempts) {
          const delay = Math.min(100 * 2 ** attempt, 2000);
          logger.warn(
            { code: err.code, attempt, delay },
            'Retrying transaction after retryable error'
          );
          await sleep(delay);
          continue;
        }

        throw err;
      }
    }
    throw lastError;
  };
}

export default createTransactionRunner;