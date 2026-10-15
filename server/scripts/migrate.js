#!/usr/bin/env node
/**
 * SyncExc — Database Migration Runner
 *
 * Applies pending SQL migrations in order. Uses a `schema_migrations` table
 * to track applied migrations. Safe to re-run; already-applied migrations
 * are skipped.
 *
 * Usage:
 *   node scripts/migrate.js
 *   node scripts/migrate.js --dry-run
 *   node scripts/migrate.js --target 003_billing.sql
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(__dirname, '..', '..', '.env') });
config({ path: path.resolve(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_ARG = process.argv.find((a) => a.startsWith('--target='));
const TARGET = TARGET_ARG ? TARGET_ARG.split('=')[1] : null;

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'src', 'database', 'migrations');

function log(...args) {
  process.stdout.write(`[migrate] ${args.join(' ')}\n`);
}

function error(...args) {
  process.stderr.write(`[migrate] ERROR: ${args.join(' ')}\n`);
}

function hash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms INTEGER NOT NULL
    )
  `);
}

async function loadMigrations() {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort();

  const migrations = [];
  for (const name of files) {
    const fullPath = path.join(MIGRATIONS_DIR, name);
    const content = await fs.readFile(fullPath, 'utf8');
    migrations.push({ name, content, hash: hash(content) });
  }
  return migrations;
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query('SELECT name, hash FROM schema_migrations ORDER BY name');
  return new Map(rows.map((r) => [r.name, r.hash]));
}

async function applyMigration(client, migration) {
  const startedAt = Date.now();
  log(`applying ${migration.name}`);

  await client.query('BEGIN');
  try {
    await client.query(migration.content);
    const duration = Date.now() - startedAt;
    await client.query(
      `INSERT INTO schema_migrations (name, hash, applied_at, duration_ms) VALUES ($1, $2, NOW(), $3)`,
      [migration.name, migration.hash, duration]
    );
    await client.query('COMMIT');
    log(`applied ${migration.name} in ${duration}ms`);
  } catch (err) {
    await client.query('ROLLBACK');
    error(`failed ${migration.name}: ${err.message}`);
    throw err;
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  log('connected to database');

  try {
    await ensureMigrationsTable(client);

    const migrations = await loadMigrations();
    if (migrations.length === 0) {
      log('no migration files found');
      return;
    }

    const applied = await getAppliedMigrations(client);
    const pending = migrations.filter((m) => {
      if (!applied.has(m.name)) return true;
      return false;
    });

    if (pending.length === 0) {
      log('all migrations already applied');
      return;
    }

    log(`${pending.length} pending migration(s)`);

    if (DRY_RUN) {
      pending.forEach((m) => log(`  would apply: ${m.name}`));
      return;
    }

    for (const migration of pending) {
      if (TARGET && migration.name > TARGET) {
        log(`stopping at target ${TARGET}`);
        break;
      }
      await applyMigration(client, migration);
    }

    log('done');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  error(err.stack || err.message);
  process.exit(1);
});