import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hashPassword } from '../../src/lib/password.js';
import { createIdentityService } from '../../src/modules/identity/identity.service.js';

test('does not issue a session to a user with an unverified email', async () => {
  const password = 'ValidPassword123!';
  const user = {
    id: 'user-id',
    email: 'unverified@example.com',
    password_hash: await hashPassword(password),
    email_verified_at: null,
    status: 'pending_verification',
  };
  let sessionsCreated = false;
  const service = createIdentityService({
    db: {
      async tx(callback) {
        return callback({});
      },
    },
    queries: {
      async findUserByEmail() {
        return user;
      },
      async insertSecurityEvent() {},
      async insertSession() {
        sessionsCreated = true;
      },
    },
    rateLimiter: {
      incrementWithTtl() {
        return 1;
      },
    },
    logger: { error() {} },
  });

  await assert.rejects(
    service.login({ email: user.email, password }),
    (error) => {
      assert.equal(error.code, 'EMAIL_NOT_VERIFIED');
      assert.equal(error.status, 401);
      return true;
    },
  );
  assert.equal(sessionsCreated, false);
});
