import test from 'node:test';
import assert from 'node:assert/strict';
import { MfaVerifyRequestSchema } from '@syncexc/shared';
import {
  createIdentityService,
  hashSessionToken,
} from '../../src/modules/identity/identity.service.js';
import { hashPassword } from '../../src/lib/password.js';

const user = {
  id: 'bb4ce3d6-8656-47c0-80a3-c28e583a891e',
  email: 'user@example.test',
  username: 'testuser',
  display_name: 'Test User',
  email_verified_at: null,
};

function createService({ mailerSend, challenge, overrides = {} } = {}) {
  const storedChallenges = [];
  const securityEvents = [];
  const queries = {
    emailExists: async () => false,
    usernameExists: async () => false,
    insertUser: async () => ({ ...user }),
    ensureSecuritySettings: async () => {},
    ensureDefaultNotificationPreferences: async () => {},
    insertAuthMethod: async () => {},
    insertChallenge: async (_tx, value) => storedChallenges.push(value),
    findChallengeByTokenHash: async (tokenHash) =>
      tokenHash === hashSessionToken('v'.repeat(32)) ? challenge || null : null,
    consumeChallenge: async () => true,
    markEmailVerified: async (userId, email) => ({
      ...user,
      id: userId,
      email,
      email_verified_at: new Date(),
    }),
    findUserById: async () => ({ ...user, email_verified_at: new Date() }),
    insertSecurityEvent: async (event) => securityEvents.push(event),
    ...overrides,
  };
  const service = createIdentityService({
    db: { tx: async (callback) => callback({}) },
    queries,
    rateLimiter: { incrementWithTtl: () => 1 },
    mailer: { send: mailerSend || (async () => ({ messageId: 'message-id' })) },
    push: {},
    events: { publish: async () => {} },
    audit: {},
    profileImages: {},
    logger: { error() {}, warn() {}, info() {} },
  });
  return { service, storedChallenges, securityEvents };
}

test('registration persists only a token hash and reports provider acceptance', async () => {
  let outboundEmail;
  const { service, storedChallenges } = createService({
    mailerSend: async (payload) => {
      outboundEmail = payload;
      return { messageId: 'resend-message-id', deliveryId: 'delivery-id' };
    },
  });

  const result = await service.register({
    email: user.email,
    password: 'A-secure-Password-123!',
    username: user.username,
    displayName: user.display_name,
  });

  assert.equal(result.user.email_verified_at, null);
  assert.equal(result.verificationEmail.status, 'accepted');
  assert.equal(result.verificationEmail.deliveryId, 'delivery-id');
  assert.equal(storedChallenges.length, 1);
  assert.equal(storedChallenges[0].challengeType, 'email_verification');
  assert.equal(storedChallenges[0].tokenHash.length, 64);
  assert.ok(outboundEmail.text.includes('/verify-email?token='));
  const token = new URL(outboundEmail.text.match(/https?:\/\/\S+/)[0]).searchParams.get('token');
  assert.ok(token);
  assert.equal(storedChallenges[0].tokenHash, hashSessionToken(token));
  assert.notEqual(storedChallenges[0].tokenHash, token);
});

test('registration keeps the account and reports a recoverable send failure', async () => {
  const { service, storedChallenges } = createService({
    mailerSend: async () => {
      const error = new Error('Resend rejected the request');
      error.errorCategory = 'provider_rejected';
      throw error;
    },
  });

  const result = await service.register({
    email: user.email,
    password: 'A-secure-Password-123!',
    username: user.username,
    displayName: user.display_name,
  });

  assert.equal(result.user.id, user.id);
  assert.equal(result.user.email_verified_at, null);
  assert.deepEqual(result.verificationEmail, {
    status: 'failed',
    errorCategory: 'provider_rejected',
  });
  assert.equal(storedChallenges.length, 1);
});

test('authenticated resend returns a sanitized provider rejection reason', async () => {
  const providerReason = 'Invalid from address for this Resend account';
  const { service } = createService({
    mailerSend: async () => {
      const error = new Error(providerReason);
      error.errorCategory = 'invalid_request';
      error.failureReason = providerReason;
      throw error;
    },
    overrides: {
      findUserById: async () => user,
      invalidateActiveChallenges: async () => {},
    },
  });

  const result = await service.resendVerificationEmail({
    userId: user.id,
    ip: '203.0.113.1',
  });

  assert.equal(result.emailSent, false);
  assert.equal(result.errorCategory, 'invalid_request');
  assert.equal(result.failureReason, providerReason);
});

test('verification consumes the challenge and rejects invalid, expired, and replayed tokens', async () => {
  let challengeConsumed = false;
  const validChallenge = {
    id: 'challenge-id',
    user_id: user.id,
    email: user.email,
    challenge_type: 'email_verification',
    consumed_at: null,
    expires_at: new Date(Date.now() + 60_000),
  };
  const { service } = createService({
    challenge: validChallenge,
    overrides: {
      consumeChallenge: async () => {
        if (challengeConsumed) return false;
        challengeConsumed = true;
        return true;
      },
    },
  });

  const result = await service.verifyEmail({ token: 'v'.repeat(32) });
  assert.equal(result.status, 'verified');
  assert.equal(result.user.email_verified_at instanceof Date, true);
  await assert.rejects(
    service.verifyEmail({ token: 'v'.repeat(32) }),
    (error) => error.details?.reason === 'invalid'
  );
  await assert.rejects(
    service.verifyEmail({ token: 'x'.repeat(32) }),
    (error) => error.details?.reason === 'invalid'
  );

  const expiredService = createService({
    challenge: { ...validChallenge, expires_at: new Date(Date.now() - 1) },
  }).service;
  await assert.rejects(
    expiredService.verifyEmail({ token: 'v'.repeat(32) }),
    (error) => error.details?.reason === 'expired'
  );
});

test('MFA verification accepts the raw challenge token sent by the client', () => {
  const valid = MfaVerifyRequestSchema.validate({
    challengeToken: 'c'.repeat(64),
    code: '123456',
    method: 'totp',
  });
  assert.equal(valid.error, undefined);
  assert.ok(MfaVerifyRequestSchema.validate({
    challengeId: 'bb4ce3d6-8656-47c0-80a3-c28e583a891e',
    code: '123456',
  }).error);
});

test('password login returns a raw, one-use MFA token while persisting only its hash', async () => {
  const password = 'A-secure-Password-123!';
  const passwordHash = await hashPassword(password);
  let storedChallenge;
  const service = createIdentityService({
    db: {
      tx: async (callback) => callback({}),
    },
    queries: {
      findUserByEmail: async () => ({ ...user, password_hash: passwordHash, status: 'active' }),
      getSecuritySettings: async () => ({ mfa_enabled_at: new Date() }),
      insertChallenge: async (_tx, value) => {
        storedChallenge = value;
      },
      insertSecurityEvent: async () => {},
    },
    rateLimiter: { incrementWithTtl: () => 1 },
    mailer: { send: async () => ({}) },
    push: {},
    events: { publish: async () => {} },
    audit: {},
    profileImages: {},
    logger: { error() {}, warn() {}, info() {} },
  });

  const result = await service.login({
    email: user.email,
    password,
    ip: '203.0.113.8',
    userAgent: 'test-agent',
  });

  assert.equal(result.mfaRequired, true);
  assert.ok(result.challengeToken);
  assert.equal(result.challengeId, undefined);
  assert.equal(storedChallenge.challengeType, 'mfa_verification');
  assert.equal(storedChallenge.tokenHash, hashSessionToken(result.challengeToken));
});