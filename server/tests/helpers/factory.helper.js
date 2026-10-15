/**
 * SyncExc Server — Test factories
 *
 * Create test data for common entities. Every factory takes a db pool and
 * returns the created row.
 */

import { randomUUID, createHash } from 'node:crypto';
import { hashPassword } from '../../src/lib/password.js';

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createTestUser(db, overrides = {}) {
  const id = randomUUID();
  const email = overrides.email || `test_${id.slice(0, 8)}@example.test`;
  const password = overrides.password || 'TestPassword123!';
  const passwordHash = await hashPassword(password);

  const result = await db.query(
    `
    INSERT INTO users (
      id, email, email_normalized, password_hash, username, username_normalized,
      display_name, status, email_verified_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', now())
    RETURNING *
    `,
    [
      id,
      email,
      email.toLowerCase(),
      passwordHash,
      `user_${id.slice(0, 8)}`,
      `user_${id.slice(0, 8)}`,
      overrides.displayName || 'Test User',
    ]
  );

  return { ...result.rows[0], plaintextPassword: password };
}

export async function createTestWorkspace(db, ownerId, overrides = {}) {
  const id = randomUUID();
  const result = await db.query(
    `
    INSERT INTO workspaces (id, name, type, owner_id, status)
    VALUES ($1, $2, $3, $4, 'active')
    RETURNING *
    `,
    [
      id,
      overrides.name || 'Test Workspace',
      overrides.type || 'personal',
      ownerId,
    ]
  );

  await db.query(
    `
    INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
    VALUES ($1, $2, 'owner', 'active')
    `,
    [id, ownerId]
  );

  return result.rows[0];
}

export async function createTestSession(db, userId, overrides = {}) {
  const id = randomUUID();
  const token = overrides.token || `session_${id}`;
  const tokenHash = hashToken(token);

  const result = await db.query(
    `
    INSERT INTO user_sessions (id, user_id, session_token_hash, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [
      id,
      userId,
      tokenHash,
      overrides.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
    ]
  );

  return { ...result.rows[0], plaintextToken: token };
}

export async function createTestConnection(db, workspaceId, ownerId, overrides = {}) {
  const id = randomUUID();
  const result = await db.query(
    `
    INSERT INTO exchange_connections (
      id, workspace_id, owner_id, exchange_code, environment, label, status, capabilities
    )
    VALUES ($1, $2, $3, $4, 'live', $5, 'active', $6)
    RETURNING *
    `,
    [
      id,
      workspaceId,
      ownerId,
      overrides.exchangeCode || 'binance',
      overrides.label || `Connection ${id.slice(0, 6)}`,
      JSON.stringify(overrides.capabilities || { spot: true, futures: true }),
    ]
  );
  return result.rows[0];
}

export async function createTestAccount(db, connectionId, overrides = {}) {
  const id = randomUUID();
  const result = await db.query(
    `
    INSERT INTO exchange_accounts (
      id, connection_id, exchange_account_id, account_type, status
    )
    VALUES ($1, $2, $3, $4, 'active')
    RETURNING *
    `,
    [
      id,
      connectionId,
      overrides.exchangeAccountId || `acc_${id.slice(0, 6)}`,
      overrides.accountType || 'spot',
    ]
  );
  return result.rows[0];
}

export async function createTestSource(db, workspaceId, ownerId, overrides = {}) {
  const id = randomUUID();
  const result = await db.query(
    `
    INSERT INTO signal_sources (id, workspace_id, owner_id, type, name, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      id,
      workspaceId,
      ownerId,
      overrides.type || 'telegram',
      overrides.name || `Source ${id.slice(0, 6)}`,
      overrides.status || 'active',
    ]
  );
  return result.rows[0];
}

export async function createTestTicket(db, requesterId, overrides = {}) {
  const id = randomUUID();
  const reference = `SC-TEST-${id.slice(0, 8).toUpperCase()}`;
  const result = await db.query(
    `
    INSERT INTO support_tickets (
      id, reference, requester_id, subject, category, description, priority, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [
      id,
      reference,
      requesterId,
      overrides.subject || 'Test ticket',
      overrides.category || 'other',
      overrides.description || 'This is a test ticket with sufficient description.',
      overrides.priority || 'normal',
      overrides.status || 'new',
    ]
  );
  return result.rows[0];
}

export async function createTestAdminRole(db, name) {
  const result = await db.query(
    `
    INSERT INTO admin_role_definitions (name, description, is_system)
    VALUES ($1, $2, false)
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING *
    `,
    [name, `Test role ${name}`]
  );
  return result.rows[0];
}

export async function assignAdminRole(db, userId, roleName, permissions = []) {
  const role = await createTestAdminRole(db, roleName);

  // Ensure permissions exist
  for (const permissionKey of permissions) {
    await db.query(
      `
      INSERT INTO admin_permission_definitions (permission_key, category, description)
      VALUES ($1, 'test', $1)
      ON CONFLICT (permission_key) DO NOTHING
      `,
      [permissionKey]
    );
    await db.query(
      `
      INSERT INTO admin_role_permissions (role_id, permission_id)
      SELECT $1, id FROM admin_permission_definitions WHERE permission_key = $2
      ON CONFLICT DO NOTHING
      `,
      [role.id, permissionKey]
    );
  }

  await db.query(
    `
    INSERT INTO admin_user_role_assignments (user_id, role_id)
    VALUES ($1, $2)
    `,
    [userId, role.id]
  );

  return role;
}