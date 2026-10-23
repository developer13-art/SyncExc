import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createIdentityController } from '../../src/modules/identity/identity.controller.js';
import { createIdentityService } from '../../src/modules/identity/identity.service.js';

describe('identity referral attribution', () => {
  it('passes the submitted referral code into account registration', async () => {
    let registrationInput;
    const req = {
      id: 'request-1',
      ip: '203.0.113.2',
      headers: { 'user-agent': 'test-agent' },
      body: {
        email: 'new@example.com',
        password: 'ValidPass123!',
        username: 'new_user',
        displayName: 'New User',
        referralCode: 'ABC123',
      },
    };
    const res = {
      req,
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    const controller = createIdentityController({
      service: {
        async register(details) {
          registrationInput = details;
          return {
            id: 'user-1',
            email: details.email,
            username: details.username,
            display_name: details.displayName,
          };
        },
      },
    });

    await controller.register(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(registrationInput.referralCode, 'ABC123');
  });

  it('attributes a new account using the normalized referral code', async () => {
    let attributed;
    const user = {
      id: 'user-1',
      email: 'new@example.com',
      username: 'new_user',
    };
    const service = createIdentityService({
      db: {
        async tx(callback) {
          return callback({});
        },
      },
      queries: {
        async emailExists() { return false; },
        async usernameExists() { return false; },
        async insertUser() { return user; },
        async ensureSecuritySettings() {},
        async ensureDefaultNotificationPreferences() {},
        async insertAuthMethod() {},
        async insertChallenge() {},
        async insertSecurityEvent() {},
      },
      events: {
        async publish() {},
      },
      referralAttribution: async (details) => {
        attributed = details;
        return { id: 'attribution-1' };
      },
      logger: {
        warn() {},
        error() {},
      },
    });

    await service.register({
      email: user.email,
      password: 'ValidPass123!',
      username: user.username,
      displayName: 'New User',
      referralCode: 'gmce6gv7r9',
      ip: '203.0.113.2',
      userAgent: 'test-agent',
    });

    assert.deepEqual(attributed, {
      userId: user.id,
      referralCode: 'GMCE6GV7R9',
      ipAddress: '203.0.113.2',
      userAgent: 'test-agent',
    });
  });
});
