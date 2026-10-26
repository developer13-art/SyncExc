import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getTestDb, closeTestDb, uniqueEmail } from '../setup.js';
import { truncateAllTables } from '../helpers/db.helper.js';
import { createIdentityModule } from '../../src/modules/identity/index.js';
import { createTestAdminRole } from '../helpers/factory.helper.js';

let db;
let identityService;

before(async () => {
  db = await getTestDb();
  await truncateAllTables(db);

  const services = {
    db,
    rateLimiter: {
      incrementWithTtl: () => 1,
    },
    mailer: {
      send: async () => ({ messageId: 'test' }),
    },
    push: {
      isEnabled: () => false,
    },
    events: {
      publish: async () => ({ eventId: 'test' }),
      emitNow: () => ({}),
      subscribe: () => () => {},
    },
    audit: {
      write: async () => ({ id: 'audit' }),
    },
    idempotency: {
      run: async ({ execute }) => execute(),
    },
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      trace: () => {},
    },
  };

  const module = createIdentityModule({ services });
  identityService = module.service;
});

after(async () => {
  await closeTestDb();
});

test('register creates a user with hashed password', async () => {
  const email = uniqueEmail('reg');
  const user = await identityService.register({
    email,
    password: 'TestPassword123!',
    username: `user_${Date.now()}`,
    displayName: 'Test User',
    ip: '127.0.0.1',
    userAgent: 'test',
  });

  assert.ok(user.id);
  assert.equal(user.email, email);
  assert.equal(user.status, 'pending_verification');
  assert.ok(user.password_hash.startsWith('$2'));
});

test('login returns session for active verified user', async () => {
  const email = uniqueEmail('login');
  const registered = await identityService.register({
    email,
    password: 'TestPassword123!',
    username: `user_${Date.now()}_2`,
    displayName: 'Test User',
    ip: '127.0.0.1',
    userAgent: 'test',
  });

  // Manually verify the email
  await db.query(
    `UPDATE users SET email_verified_at = now(), status = 'active' WHERE id = $1`,
    [registered.id]
  );

  const result = await identityService.login({
    email,
    password: 'TestPassword123!',
    ip: '127.0.0.1',
    userAgent: 'test',
  });

  assert.equal(result.mfaRequired, false);
  assert.ok(result.session);
  assert.ok(result.sessionToken);
  assert.ok(result.accessToken);
});

test('login fails with wrong password', async () => {
  const email = uniqueEmail('badpass');
  await identityService.register({
    email,
    password: 'TestPassword123!',
    username: `user_${Date.now()}_3`,
    displayName: 'Test User',
    ip: '127.0.0.1',
    userAgent: 'test',
  });

  await db.query(`UPDATE users SET email_verified_at = now(), status = 'active' WHERE email = $1`, [email]);

  await assert.rejects(
    () =>
      identityService.login({
        email,
        password: 'WrongPassword',
        ip: '127.0.0.1',
        userAgent: 'test',
      }),
    /Invalid credentials/
  );
});

test('cannot register with duplicate email', async () => {
  const email = uniqueEmail('dup');
  await identityService.register({
    email,
    password: 'TestPassword123!',
    username: `user_${Date.now()}_4`,
    displayName: 'Test User',
    ip: '127.0.0.1',
    userAgent: 'test',
  });

  await assert.rejects(
    () =>
      identityService.register({
        email,
        password: 'TestPassword123!',
        username: `user_${Date.now()}_5`,
        displayName: 'Other',
        ip: '127.0.0.1',
        userAgent: 'test',
      }),
    /already exists/
  );
});