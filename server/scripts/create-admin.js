/**
 * SyncExc — Create Administrator
 *
 * Creates an administrator account or upgrades an existing user,
 * then assigns one or more administrator roles.
 *
 * Usage:
 *   node scripts/create-admin.js
 *   node scripts/create-admin.js --email admin@example.com --role platform_administrator
 *   node scripts/create-admin.js --email existing@example.com --role billing_administrator --existing
 *
 * For password input, prefer the interactive prompt instead of passing
 * passwords through command-line arguments.
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
  const index = process.argv.indexOf(`--${name}`);

  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }

  const equalsArgument = process.argv.find((item) =>
    item.startsWith(`--${name}=`)
  );

  if (equalsArgument) {
    return equalsArgument.slice(`--${name}=`.length);
  }

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

  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12) {
    return 'Password must be at least 12 characters';
  }

  if (!/[a-z]/.test(password)) {
    return 'Password must contain a lowercase letter';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must contain an uppercase letter';
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must contain a digit';
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain a special character';
  }

  return null;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function generateUsername(email) {
  const localPart = email.split('@')[0];

  let username = localPart
    .replace(/[^a-z0-9_-]/gi, '_')
    .toLowerCase()
    .slice(0, 32);

  // The database requires a 3–32 character username whose first and
  // last characters are alphanumeric or underscores.
  username = username.replace(/^[^a-z0-9_]+|[^a-z0-9_]+$/g, '');

  if (username.length < 3) {
    username = `admin_${username}`.slice(0, 32);
  }

  if (!/^[a-z0-9_][a-z0-9_-]{1,30}[a-z0-9_]$/.test(username)) {
    username = `admin_${username}`.slice(0, 32);
    username = username.replace(/[^a-z0-9_-]/g, '_');

    if (!/^[a-z0-9_][a-z0-9_-]{1,30}[a-z0-9_]$/.test(username)) {
      username = `admin_${Date.now().toString().slice(-10)}`;
    }
  }

  return username;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    error('DATABASE_URL is not set. Check your .env configuration.');
    process.exitCode = 1;
    return;
  }

  const existingOnly = flag('existing');

  let email = arg('email');
  let password = arg('password');
  let displayName = arg('displayName', 'Platform Administrator');
  let username = arg('username');
  const roleName = arg('role', 'platform_administrator');

  if (!email) {
    email = await promptIfMissing(null, 'Admin email: ');
  }

  email = normalizeEmail(email);

  if (!existingOnly && !password) {
    password = await promptIfMissing(null, 'Admin password: ');
  }

  if (!validateEmail(email)) {
    error('Invalid email address.');
    process.exitCode = 1;
    return;
  }

  if (!roleName.trim()) {
    error('Admin role name cannot be empty.');
    process.exitCode = 1;
    return;
  }

  if (!existingOnly) {
    const passwordError = validatePassword(password);

    if (passwordError) {
      error(passwordError);
      process.exitCode = 1;
      return;
    }
  }

  if (!displayName || !displayName.trim()) {
    error('Display name cannot be empty.');
    process.exitCode = 1;
    return;
  }

  if (!username && !existingOnly) {
    username = generateUsername(email);
  } else if (username) {
    username = normalizeUsername(username);
  }

  if (!existingOnly && !/^[a-z0-9_][a-z0-9_-]{1,30}[a-z0-9_]$/.test(username)) {
    error(
      'Username must be 3–32 characters, use lowercase letters, digits, underscores or hyphens, and start and end with a letter, digit or underscore.'
    );
    process.exitCode = 1;
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
  });

  let transactionStarted = false;

  try {
    await client.connect();
    log('connected');

    await client.query('BEGIN');
    transactionStarted = true;

    let userId;

    const existing = await client.query(
      `
      SELECT id
      FROM users
      WHERE email_normalized = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [email]
    );

    if (existing.rowCount > 0) {
      userId = existing.rows[0].id;

      log(`user exists: ${email} (${userId})`);

      if (!existingOnly && password) {
        const passwordHash = await bcrypt.hash(password, 12);

        await client.query(
          `
          UPDATE users
          SET
            password_hash = $1,
            updated_at = NOW()
          WHERE id = $2
          `,
          [passwordHash, userId]
        );

        log('password updated');
      }
    } else {
      if (existingOnly) {
        throw new Error(
          `No existing, non-deleted user found with email ${email}.`
        );
      }

      const normalizedUsername = normalizeUsername(username);

      const usernameCheck = await client.query(
        `
        SELECT id
        FROM users
        WHERE username_normalized = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [normalizedUsername]
      );

      if (usernameCheck.rowCount > 0) {
        throw new Error(
          `Username "${username}" is already in use. Rerun with --username followed by a different username.`
        );
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const insert = await client.query(
        `
        INSERT INTO users (
          id,
          email,
          email_normalized,
          username,
          username_normalized,
          password_hash,
          display_name,
          status,
          email_verified_at,
          created_at,
          updated_at
        )
        VALUES (
          gen_random_uuid(),
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          'active',
          NOW(),
          NOW(),
          NOW()
        )
        RETURNING id
        `,
        [
          email,
          email,
          username,
          normalizedUsername,
          passwordHash,
          displayName.trim(),
        ]
      );

      userId = insert.rows[0].id;

      log(`user created: ${email} (${userId})`);
    }

    const role = await client.query(
      `
      SELECT id
      FROM admin_role_definitions
      WHERE name = $1
      LIMIT 1
      `,
      [roleName]
    );

    if (role.rowCount === 0) {
      throw new Error(
        `Admin role "${roleName}" not found. Run "npm run db:seed" first, and verify the role name.`
      );
    }

    await client.query(
      `
      INSERT INTO admin_user_role_assignments (
        id,
        user_id,
        role_id,
        scope_type,
        scope_id,
        assigned_at,
        assigned_by
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        NULL,
        NULL,
        NOW(),
        $1
      )
      ON CONFLICT (user_id, role_id, scope_type, scope_id)
      DO NOTHING
      `,
      [userId, role.rows[0].id]
    );

    log(`assigned role: ${roleName}`);

    await client.query('COMMIT');
    transactionStarted = false;

    log('Administrator setup completed successfully.');
    log(`Email: ${email}`);
    log(`Role: ${roleName}`);
    log('Password is not displayed for security.');
  } catch (err) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
        transactionStarted = false;
      } catch (rollbackError) {
        error(`Rollback failed: ${rollbackError.message}`);
      }
    }

    error(err.message || String(err));
    process.exitCode = 1;
  } finally {
    try {
      await client.end();
    } catch (closeError) {
      error(`Database connection close failed: ${closeError.message}`);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  error(err.stack || err.message);
  process.exitCode = 1;
});
