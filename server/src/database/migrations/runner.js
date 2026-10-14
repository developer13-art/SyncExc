/**
 * SyncExc Server — Migration runner
 *
 * Applies SQL migration files in lexicographic order. Tracks:
 *   - filename
 *   - checksum (SHA-256 of file contents)
 *   - applied_at timestamp
 *   - duration
 *
 * Refuses to run if a previously applied migration has been modified
 * (checksum mismatch). This prevents silent schema drift.
 *
 * Usage:
 *   node scripts/migrate.js
 *   node scripts/migrate.js --reset  (destructive; dev only)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import config from '../../config.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger({ component: 'migrations' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = __dirname;

async function ensureMigrationTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id            serial PRIMARY KEY,
      filename      text NOT NULL UNIQUE,
      checksum      text NOT NULL,
      applied_at    timestamptz NOT NULL DEFAULT now(),
      duration_ms   integer NOT NULL,
      success       boolean NOT NULL DEFAULT true,
      error_message text
    );
  `);
}

async function listMigrationFiles() {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  return entries
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function fileChecksum(fullPath) {
  const content = await fs.readFile(fullPath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function appliedMigrations(db) {
  const res = await db.query(
    `SELECT filename, checksum FROM schema_migrations WHERE success = true ORDER BY filename`
  );
  const map = new Map();
  for (const row of res.rows) map.set(row.filename, row.checksum);
  return map;
}

async function runMigration(db, filename) {
  const fullPath = path.join(MIGRATIONS_DIR, filename);
  const sql = await fs.readFile(fullPath, 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');

  const started = Date.now();
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    await client.query(sql);
    const durationMs = Date.now() - started;
    await client.query(
      `INSERT INTO schema_migrations (filename, checksum, duration_ms, success)
       VALUES ($1, $2, $3, true)`,
      [filename, checksum, durationMs]
    );
    await client.query('COMMIT');
    logger.info({ filename, durationMs }, 'Migration applied');
    return { filename, durationMs, success: true };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error({ err: rollbackErr, filename }, 'Rollback failed');
    }
    // Record the failure (outside the transaction since it was rolled back).
    try {
      await client.query(
        `INSERT INTO schema_migrations (filename, checksum, duration_ms, success, error_message)
         VALUES ($1, $2, $3, false, $4)
         ON CONFLICT (filename) DO UPDATE SET success = false, error_message = EXCLUDED.error_message`,
        [filename, checksum, Date.now() - started, err.message.slice(0, 1000)]
      );
    } catch (logErr) {
      logger.error({ err: logErr, filename }, 'Failed to record migration failure');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function dropAllTables(db) {
  logger.warn('Dropping all application tables (--reset)');
  await db.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO public;
  `);
}

export async function runMigrations({ db, reset = false } = {}) {
  if (config.isProduction && reset) {
    throw new Error('Refusing to reset schema in production');
  }

  if (reset) await dropAllTables(db);

  await ensureMigrationTable(db);

  const applied = await appliedMigrations(db);
  const files = await listMigrationFiles();

  const results = { applied: [], skipped: [], failed: null };

  for (const filename of files) {
    const fullPath = path.join(MIGRATIONS_DIR, filename);
    const checksum = await fileChecksum(fullPath);

    if (applied.has(filename)) {
      if (applied.get(filename) !== checksum) {
        throw new Error(
          `Migration file '${filename}' has been modified since it was applied. ` +
            `Expected checksum ${applied.get(filename)}, got ${checksum}. ` +
            `Create a new migration instead of editing an applied one.`
        );
      }
      results.skipped.push(filename);
      continue;
    }

    try {
      const result = await runMigration(db, filename);
      results.applied.push(result);
    } catch (err) {
      results.failed = { filename, error: err.message };
      logger.error({ filename, err }, 'Migration failed; stopping');
      throw err;
    }
  }

  logger.info(
    {
      applied: results.applied.length,
      skipped: results.skipped.length,
    },
    'Migration run complete'
  );

  return results;
}

export default runMigrations;