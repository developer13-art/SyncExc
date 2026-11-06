/* Temporary E2E check: admin step-up endpoint + official-trader plan fee management. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { hashPassword } = await import('../src/lib/password.js');
const { issueAccessToken } = await import('../src/lib/jwt.js');

const BASE = 'http://localhost:4000/api/v1/admin';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const created = { userId: null, sessionIds: [], planId: null };
let failed = false;

function check(name, cond, extra) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  :: ${extra}`}`);
  if (!cond) failed = true;
}

async function api(token, method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function makeSession(userId, label) {
  const result = await pool.query(
    `INSERT INTO user_sessions (user_id, session_token_hash, device_label, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, '127.0.0.1', 'e2e-script', now() + interval '1 hour') RETURNING id`,
    [userId, `e2e-tmp-${crypto.randomUUID()}`, label],
  );
  created.sessionIds.push(result.rows[0].id);
  return issueAccessToken({ userId, sessionId: result.rows[0].id });
}

async function cleanup() {
  if (created.planId) {
    await pool.query('DELETE FROM marketplace_provider_plan_versions WHERE plan_id = $1', [created.planId]);
    await pool.query('DELETE FROM marketplace_provider_plans WHERE id = $1', [created.planId]);
  }
  for (const id of created.sessionIds) {
    await pool.query('DELETE FROM user_sessions WHERE id = $1', [id]);
  }
  if (created.userId) {
    await pool.query('DELETE FROM admin_user_role_assignments WHERE user_id = $1', [created.userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [created.userId]);
  }
}

try {
  const password = 'E2e-StepUp-#9911';
  const passwordHash = await hashPassword(password);
  const stamp = Date.now();
  const user = await pool.query(
    `INSERT INTO users (email, email_normalized, password_hash, username, username_normalized, display_name, status)
     VALUES ($1, $1, $2, $3, $3, 'E2E StepUp', 'active') RETURNING id`,
    [`e2e-stepup-${stamp}@syncexc.test`, passwordHash, `e2estepup${stamp}`],
  );
  created.userId = user.rows[0].id;

  const role = await pool.query(`SELECT id FROM admin_role_definitions WHERE name = 'platform_administrator'`);
  if (!role.rows[0]) throw new Error('platform_administrator role not found');
  await pool.query(
    `INSERT INTO admin_user_role_assignments (user_id, role_id, scope_type, scope_id, assigned_by)
     VALUES ($1, $2, 'platform', NULL, $1)`,
    [created.userId, role.rows[0].id],
  );

  const token = await makeSession(created.userId, 'e2e-stepup-plans');

  // 1. Step-up rejects a wrong password.
  let r = await api(token, 'POST', '/auth/step-up', { method: 'password', code: 'wrong-password-1', reason: 'e2e test' });
  check('step-up wrong password → 401 STEP_UP_INVALID', r.status === 401 && r.json?.error?.code === 'STEP_UP_INVALID', JSON.stringify(r));

  // 2. Step-up validates the body.
  r = await api(token, 'POST', '/auth/step-up', { method: 'password' });
  check('step-up missing code → 400', r.status === 400, JSON.stringify(r));

  // 3. Step-up succeeds with the correct password.
  r = await api(token, 'POST', '/auth/step-up', { method: 'password', code: password, reason: 'e2e verification test' });
  check('step-up correct password → 200 verified', r.status === 200 && r.json?.data?.verified === true, JSON.stringify(r));

  const session = await pool.query('SELECT step_up_at FROM user_sessions WHERE id = $1', [created.sessionIds[0]]);
  check('step_up_at recorded in DB', Boolean(session.rows[0]?.step_up_at), JSON.stringify(session.rows[0]));

  // 4. Create a plan (fee) on the official trader.
  r = await api(token, 'POST', '/official-trader/marketplace/plans', {
    name: 'E2E Test Plan',
    pricing: { amountMinor: 5000, currency: 'USD', billingInterval: 'monthly' },
    entitlements: {},
    reason: 'e2e plan creation test',
  });
  check('create plan → 201 draft', r.status === 201 && r.json?.data?.status === 'draft', JSON.stringify(r));
  created.planId = r.json?.data?.id;

  // 5. Update the subscription fee.
  r = await api(token, 'PATCH', `/official-trader/marketplace/plans/${created.planId}`, {
    pricing: { amountMinor: 7500, currency: 'USD', billingInterval: 'monthly' },
    reason: 'e2e fee update test',
  });
  check('update plan fee → 200 with new amountMinor', r.status === 200 && r.json?.data?.pricing?.amountMinor === 7500, JSON.stringify(r));

  // 6. Invalid pricing is rejected.
  r = await api(token, 'PATCH', `/official-trader/marketplace/plans/${created.planId}`, {
    pricing: { amountMinor: 100, currency: 'EUR', billingInterval: 'monthly' },
    reason: 'e2e invalid currency test',
  });
  check('invalid currency → 400', r.status === 400, JSON.stringify(r));

  // 7. Activate and retire the plan.
  r = await api(token, 'PATCH', `/official-trader/marketplace/plans/${created.planId}/status`, { status: 'active', reason: 'e2e activation test' });
  check('activate plan → 200 active', r.status === 200 && r.json?.data?.status === 'active', JSON.stringify(r));

  r = await api(token, 'PATCH', `/official-trader/marketplace/plans/${created.planId}/status`, { status: 'retired', reason: 'e2e retirement test' });
  check('retire plan → 200 retired', r.status === 200 && r.json?.data?.status === 'retired', JSON.stringify(r));

  // 8. Step-up-gated route rejects a session without fresh step-up.
  const token2 = await makeSession(created.userId, 'e2e-stepup-plans-2');
  r = await api(token2, 'POST', '/official-trader/marketplace/plans', {
    name: 'E2E No StepUp Plan',
    pricing: { amountMinor: 0, currency: 'USD', billingInterval: 'monthly' },
    entitlements: {},
    reason: 'e2e missing step-up test',
  });
  check('gated route without step-up → 428/403', r.status === 428 || r.status === 403, JSON.stringify(r));

  // 9. Audit trail recorded the step-up.
  const audit = await pool.query(
    `SELECT id FROM admin_audit_log WHERE actor_id = $1 AND action = 'admin.step_up_completed'`,
    [created.userId],
  );
  check('step-up audit entry written', audit.rowCount > 0, `rows=${audit.rowCount}`);
} catch (error) {
  failed = true;
  console.error('E2E script error:', error);
} finally {
  await cleanup();
  await pool.end();
}

process.exit(failed ? 1 : 0);
