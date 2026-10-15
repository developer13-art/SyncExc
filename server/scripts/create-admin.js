#!/usr/bin/env node
/**
 * SyncExc — Create Administrator
 *
 * Creates a new administrator account or upgrades an existing user to
 * administrator, and assigns one or more admin roles.
 *
 * Usage:
 *   node scripts/create-admin.js
 *   node scripts/create-admin.js --email admin@example.com --password 'Secret123!' --role platform_administrator
 *   node scripts/create-admin.js --email existing@example.com --role billing_administrator --existing
 */

import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(__dirname, '..', '..', '.env') });
config({ path: path.resolve(__dirname, '..', '.env') });

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split('=')[1];
  return fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function log(...args) {
  process.stdout.write(`[create-admin] ${args.join(' ')}\n`);
}

function error(...args) {
  process.stderr.write(`[create-admin] ERROR: ${args.join(' ')}\n`);
}

async function promptIfMissing(value, question) {
  if (value) return value;
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(question);
  rl.close();
  return answer;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a digit';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a special character';
  return null;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    error('DATABASE_URL is not set');
    process.exit(1);
  }

  const existingOnly = flag('existing');

  let email = arg('email');
  let password = arg('password');
  let displayName = arg('displayName', 'Platform Administrator');
  let username = arg('username');
  const roleName = arg('role', 'platform_administrator');

  if (!email) email = await promptIfMissing(null, 'Admin email: ');
  if (!existingOnly && !password) password = await promptIfMissing(null, 'Admin password: ');

  if (!validateEmail(email)) {
    error('Invalid email address');
    process.exit(1);
  }

  if (!existingOnly) {
    const pwErr = validatePassword(password);
    if (pwErr) {
      error(pwErr);
      process.exit(1);
    }
  }

  if (!username && !existingOnly) {
    username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '_').slice(0, 32).toLowerCase();
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  log('connected');

  try {
    await client.query('BEGIN');

    let userId;

    const existing = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (existing.rowCount > 0) {
      userId = existing.rows[0].id;
      log(`user exists: ${email} (${userId})`);

      if (!existingOnly && password) {
        const passwordHash = await bcrypt.hash(password, 12);
        await client.query(
          `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
          [passwordHash, userId]
        );
        log('password updated');
      }
    } else {
      if (existingOnly) {
        error(`No existing user with email ${email}`);
        await client.query('ROLLBACK');
        process.exit(1);
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const insert = await client.query(
        `
        INSERT INTO users (id, email, username, password_hash, display_name, status, email_verified_at, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, 'active', NOW(), NOW(), NOW())
        RETURNING id
        `,
        [email.toLowerCase(), username, passwordHash, displayName]
      );
      userId = insert.rows[0].id;
      log(`user created: ${email} (${userId})`);
    }

    const role = await client.query(
      `SELECT id FROM admin_role_definitions WHERE name = $1 LIMIT 1`,
      [roleName]
    );

    if (role.rowCount === 0) {
      error(`Admin role "${roleName}" not found. Run \`node scripts/seed.js\` first.`);
      await client.query('ROLLBACK');
      process.exit(1);
    }

    await client.query(
      `
      INSERT INTO admin_user_role_assignments (id, user_id, role_id, granted_at, granted_by)
      VALUES (gen_random_uuid(), $1, $2, NOW(), $1)
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [userId, role.rows[0].id]
    );

    log(`assigned role: ${roleName}`);

    await client.query('COMMIT');
    log('done');
    log('');
    log('Admin login:');
    log(`  email:    ${email}`);
    if (!existingOnly) log(`  password: ${password}`);
    log(`  role:     ${roleName}`);
  } catch (err) {
    await client.query('ROLLBACK');
    error(err.stack || err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  error(err.stack || err.message);
  process.exit(1);
});