/**
 * SyncExc Server — Test Setup
 *
 * Runs once before the entire test suite. Sets up environment, connects to
 * the test database, runs migrations, and installs global teardown.
 *
 * The test database is isolated from development. Use a separate DATABASE_URL
 * in `server/.env.test` or via environment variables when running tests.
 */

import { execSync } from 'node:child_process';
import { afterAll, beforeAll } from '@jest/globals';
import { closeDatabase, connectDatabase, getPool } from '../src/database/index.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/syncexc_test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-min-64-chars-long-xxxxxxxxxxxxxxxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-min-64-chars-long-xxxxxxxxxxxxxxxxxxxxxxxxx';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || 'test-session-secret-min-64-chars-long-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
process.env.ENCRYPTION_MASTER_KEY =
  process.env.ENCRYPTION_MASTER_KEY || 'dGVzdC1lbmNyeXB0aW9uLW1hc3Rlci1rZXktMzItYnl0ZXMtbG9uZw==';

beforeAll(async () => {
  await connectDatabase();

  // Run migrations against the test database
  execSync('node scripts/migrate.js', {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });

  // Truncate all test tables before the suite runs
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT IN ('schema_migrations')
  `);

  if (rows.length > 0) {
    const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
    await pool.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
  }
});

afterAll(async () => {
  await closeDatabase();
});