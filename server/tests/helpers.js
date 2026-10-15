/**
 * SyncExc Server — Test Helpers
 *
 * Common utilities used by every test suite:
 * - API request helper (in-process supertest)
 * - Auth helpers (register, login, obtain session cookie)
 * - Factory helpers (create user, workspace, connection)
 * - Database inspection helpers
 * - Random data generators
 */

import crypto from 'node:crypto';
import request from 'supertest';
import { getPool } from '../src/database/index.js';
import { createApp } from '../src/app.js';

let cachedApp = null;

export async function getTestApp() {
  if (!cachedApp) {
    cachedApp = await createApp();
  }
  return cachedApp;
}

/**
 * Make an HTTP request against the in-process app.
 */
export async function api(options) {
  const app = await getTestApp();
  const method = (options.method || 'get').toLowerCase();
  let req = request(app)[method](options.path);

  if (options.body) req = req.send(options.body);
  if (options.query) req = req.query(options.query);
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) req = req.set(k, v);
  }
  if (options.cookies) {
    const cookieHeader = Object.entries(options.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    req = req.set('Cookie', cookieHeader);
  }

  return req;
}

/* =============================================================================
 * AUTH HELPERS
 * ========================================================================== */

let userCounter = 0;

export function uniqueEmail(prefix = 'user') {
  userCounter += 1;
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${Date.now()}-${userCounter}-${rand}@example.test`;
}

export function uniqueUsername(prefix = 'user') {
  userCounter += 1;
  const rand = crypto.randomBytes(3).toString('hex');
  return `${prefix}_${Date.now()}_${userCounter}_${rand}`.slice(0, 32).toLowerCase();
}

export function strongPassword() {
  return 'TestPassword!2345' + crypto.randomBytes(2).toString('hex');
}

/**
 * Register a new user through the API and return the user object plus
 * the session cookie needed for authenticated requests.
 */
export async function registerUser(overrides = {}) {
  const email = overrides.email || uniqueEmail();
  const username = overrides.username || uniqueUsername();
  const password = overrides.password || strongPassword();

  const res = await api({
    method: 'post',
    path: '/api/v1/auth/register',
    body: {
      email,
      username,
      password,
      displayName: overrides.displayName || 'Test User',
      acceptedTerms: true,
      acceptedPrivacy: true,
      timezone: 'UTC',
      preferredLanguage: 'en',
    },
  });

  if (res.status !== 201) {
    throw new Error(`Failed to register user: ${res.status} ${JSON.stringify(res.body)}`);
  }

  // Auto-verify email for tests (bypass verification flow)
  const pool = getPool();
  await pool.query(
    `UPDATE users SET email_verified_at = NOW(), status = 'active' WHERE id = $1`,
    [res.body.user.id]
  );

  // Login to get a session
  const loginRes = await api({
    method: 'post',
    path: '/api/v1/auth/login',
    body: { email, password, rememberMe: false },
  });

  if (loginRes.status !== 200) {
    throw new Error(`Failed to login user: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }

  const setCookie = loginRes.headers['set-cookie'] || [];
  const sessionCookie = setCookie
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('syncexc_session='));

  if (!sessionCookie) {
    throw new Error('No session cookie returned after login');
  }

  const cookieValue = sessionCookie.split('=')[1];

  return {
    user: { ...res.body.user, password },
    email,
    password,
    sessionCookie: cookieValue,
    cookies: { syncexc_session: cookieValue },
  };
}

/**
 * Register a user without auto-verifying email (for testing verification flow).
 */
export async function registerUnverifiedUser(overrides = {}) {
  const email = overrides.email || uniqueEmail();
  const username = overrides.username || uniqueUsername();
  const password = overrides.password || strongPassword();

  const res = await api({
    method: 'post',
    path: '/api/v1/auth/register',
    body: {
      email,
      username,
      password,
      displayName: overrides.displayName || 'Test User',
      acceptedTerms: true,
      acceptedPrivacy: true,
      timezone: 'UTC',
      preferredLanguage: 'en',
    },
  });

  if (res.status !== 201) {
    throw new Error(`Failed to register user: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return { user: res.body.user, email, password };
}

/* =============================================================================
 * FACTORY HELPERS
 * ========================================================================== */

/**
 * Create a workspace directly through the API.
 */
export async function createWorkspace(auth, overrides = {}) {
  const res = await api({
    method: 'post',
    path: '/api/v1/workspaces',
    cookies: auth.cookies,
    body: {
      name: overrides.name || `Test Workspace ${Date.now()}`,
      type: overrides.type || 'organization',
      description: overrides.description || 'Test workspace',
      timezone: 'UTC',
      preferredLanguage: 'en',
    },
  });

  if (res.status !== 201) {
    throw new Error(`Failed to create workspace: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body.workspace;
}

/**
 * Insert a mock exchange connection directly into the database.
 * Used for tests that don't need to exercise the full connection wizard.
 */
export async function createConnectionDirect(workspaceId, ownerId, overrides = {}) {
  const pool = getPool();

  const { rows } = await pool.query(
    `
    INSERT INTO exchange_connections (
      id, workspace_id, owner_id, exchange, environment, label,
      status, capabilities, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
    ) RETURNING *
    `,
    [
      workspaceId,
      ownerId,
      overrides.exchange || 'binance',
      overrides.environment || 'testnet',
      overrides.label || 'Test Connection',
      overrides.status || 'active',
      JSON.stringify(overrides.capabilities || { accountRead: 'verified' }),
    ]
  );

  return rows[0];
}

/* =============================================================================
 * DATABASE HELPERS
 * ========================================================================== */

export async function queryOne(sql, params = []) {
  const pool = getPool();
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

export async function queryAll(sql, params = []) {
  const pool = getPool();
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function exec(sql, params = []) {
  const pool = getPool();
  return pool.query(sql, params);
}

/**
 * Truncate specific tables between tests. Use `test.afterEach(truncateTables([...]))`.
 */
export function truncateTables(tables) {
  return async () => {
    if (!tables.length) return;
    const pool = getPool();
    const list = tables.map((t) => `"${t}"`).join(', ');
    await pool.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  };
}

/* =============================================================================
 * ASSERTION HELPERS
 * ========================================================================== */

export function expectSuccess(res, statusCode = 200) {
  if (res.status !== statusCode) {
    throw new Error(
      `Expected status ${statusCode}, got ${res.status}. Body: ${JSON.stringify(res.body)}`
    );
  }
}

export function expectError(res, expectedCode, statusCode) {
  if (statusCode && res.status !== statusCode) {
    throw new Error(
      `Expected status ${statusCode}, got ${res.status}. Body: ${JSON.stringify(res.body)}`
    );
  }
  const code = res.body?.error?.code || res.body?.code;
  if (code !== expectedCode) {
    throw new Error(
      `Expected error code "${expectedCode}", got "${code}". Body: ${JSON.stringify(res.body)}`
    );
  }
}

/* =============================================================================
 * TIME HELPERS
 * ========================================================================== */

export function freezeTime(fixedDate) {
  const original = Date.now;
  Date.now = () => new Date(fixedDate).getTime();
  return () => {
    Date.now = original;
  };
}

/* =============================================================================
 * RANDOM HELPERS
 * ========================================================================== */

export function randomDecimal(min = '1', max = '100', precision = 8) {
  const lo = Number(min);
  const hi = Number(max);
  const value = lo + Math.random() * (hi - lo);
  return value.toFixed(precision);
}

export function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function randomHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}