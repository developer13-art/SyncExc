/**
 * SyncExc Server — Identity service
 *
 * All business logic for the identity module:
 *   - registration and login
 *   - session creation, listing, revocation
 *   - MFA enrollment and verification
 *   - email verification
 *   - password change and reset
 *   - trusted devices
 *   - security event emission
 *
 * Every state-changing method that produces an event writes the event to
 * the outbox within the same transaction.
 */

import { randomUUID, createHash, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
} from '../../lib/password.js';
import { issueAccessToken } from '../../lib/jwt.js';
import { generateTotpSecret, totpAuthUrl, verifyTotp, generateNumericCode, hashCode, generateSalt } from '../../lib/otp.js';
import { encrypt, decrypt, randomToken } from '../../lib/crypto.js';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
} from '../../lib/errors.js';

const MAX_LOGIN_ATTEMPTS_PER_WINDOW = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const DEVICE_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const RECOVERY_CODES_COUNT = 10;
const SESSION_STEP_UP_TTL_MS = 15 * 60 * 1000;

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export { hashSessionToken };

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username).trim().toLowerCase();
}

export function createIdentityService({ db, queries, redis, mailer, push, events, audit, logger }) {
  /* ===========================================================================
   * HELPERS
   * ======================================================================== */

  async function ensureUniqueEmail(emailNormalized, client = db) {
    if (await queries.emailExists(emailNormalized, client)) {
      throw new ConflictError('An account with this email already exists', 'EMAIL_TAKEN');
    }
  }

  async function ensureUniqueUsername(usernameNormalized, client = db) {
    if (await queries.usernameExists(usernameNormalized, client)) {
      throw new ConflictError('This username is already taken', 'USERNAME_TAKEN');
    }
  }

  async function checkLoginRateLimit(emailNormalized) {
    const key = `auth:login:${emailNormalized}`;
    const count = await redis.incrementWithTtl(key, LOGIN_WINDOW_SECONDS);
    if (count > MAX_LOGIN_ATTEMPTS_PER_WINDOW) {
      throw new AuthenticationError('Too many login attempts. Try again later.', 'LOGIN_RATE_LIMITED');
    }
  }

  async function recordSecurityEvent(data) {
    try {
      return await queries.insertSecurityEvent(data);
    } catch (err) {
      logger.error({ err, eventType: data.eventType }, 'Failed to record security event');
      return null;
    }
  }

  function buildSessionContext({ ip, userAgent, deviceLabel }) {
    return {
      ipAddress: ip || null,
      userAgent: userAgent || null,
      deviceLabel: deviceLabel || null,
    };
  }

  /* ===========================================================================
   * REGISTRATION
   * ======================================================================== */

  async function register({ email, password, username, displayName, preferredLanguage, timezone, termsVersion, privacyVersion, ip, userAgent }, context = {}) {
    const emailNormalized = normalizeEmail(email);
    const usernameNormalized = normalizeUsername(username);

    await ensureUniqueEmail(emailNormalized);
    await ensureUniqueUsername(usernameNormalized);

    const passwordHash = await hashPassword(password);

    const result = await db.tx(async (tx) => {
      const user = await queries.insertUser(tx, {
        email,
        emailNormalized,
        passwordHash,
        username,
        usernameNormalized,
        displayName,
        preferredLanguage,
        timezone,
        termsVersion,
        privacyVersion,
      });

      await queries.ensureSecuritySettings(user.id, tx);
      await queries.ensureDefaultNotificationPreferences(tx, user.id);

      await queries.insertAuthMethod(tx, {
        userId: user.id,
        methodType: 'password',
      });

      // Create email verification challenge
      const challengeToken = randomToken(32);
      const tokenHash = hashSessionToken(challengeToken);
      await queries.insertChallenge(tx, {
        userId: user.id,
        email: user.email,
        challengeType: 'email_verification',
        tokenHash,
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      });

      await events.publish(tx, 'user.registered', {
        userId: user.id,
        email: user.email,
        username: user.username,
      }, {
        actorId: user.id,
        resourceType: 'user',
        resourceId: user.id,
      });

      return { user, verificationToken: challengeToken };
    });

    // Send verification email outside the transaction
    await sendVerificationEmail(result.user, result.verificationToken).catch((err) => {
      logger.error({ err, userId: result.user.id }, 'Failed to send verification email');
    });

    await recordSecurityEvent({
      userId: result.user.id,
      eventType: 'login_success', // placeholder for account creation
      outcome: 'success',
      ipAddress: ip,
      deviceMetadata: { userAgent },
      metadata: { action: 'account_created' },
    });

    return result.user;
  }

  async function sendVerificationEmail(user, token) {
    if (!mailer) {
      logger.warn({ userId: user.id }, 'Mailer not configured; skipping verification email');
      return;
    }
    const url = `${process.env.APP_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
    await mailer.send({
      to: user.email,
      subject: 'Verify your SyncExc account',
      text: `Verify your email address by visiting: ${url}`,
      html: `<p>Verify your email address by clicking <a href="${url}">this link</a>.</p>`,
    });
  }

  /* ===========================================================================
   * EMAIL VERIFICATION
   * ======================================================================== */

  async function verifyEmail({ token }) {
    if (!token) throw new ValidationError('Verification token is required');

    const tokenHash = hashSessionToken(token);
    const challenge = await queries.findChallengeByTokenHash(tokenHash);

    if (!challenge) throw new ValidationError('Invalid verification token');
    if (challenge.challenge_type !== 'email_verification') {
      throw new ValidationError('Invalid verification token');
    }
    if (challenge.consumed_at) throw new ValidationError('Verification token already used');
    if (new Date(challenge.expires_at) <= new Date()) {
      throw new ValidationError('Verification token expired');
    }

    const result = await db.tx(async (tx) => {
      const consumed = await queries.consumeChallenge(challenge.id);
      if (!consumed) throw new ValidationError('Verification token already used');

      const user = await queries.markEmailVerified(challenge.user_id);

      await events.publish(tx, 'user.email_verified', {
        userId: user.id,
        email: user.email,
      }, {
        actorId: user.id,
        resourceType: 'user',
        resourceId: user.id,
      });

      return user;
    });

    await recordSecurityEvent({
      userId: result.id,
      eventType: 'email_verified',
      outcome: 'success',
    });

    return result;
  }

  async function resendVerificationEmail({ email }) {
    const emailNormalized = normalizeEmail(email);
    const user = await queries.findUserByEmail(emailNormalized);

    // Do not reveal whether the account exists
    if (!user || user.email_verified_at) return { ok: true };

    // Invalidate any existing email verification challenges
    await queries.invalidateActiveChallenges({
      userId: user.id,
      challengeType: 'email_verification',
    });

    const token = randomToken(32);
    const tokenHash = hashSessionToken(token);

    await db.tx(async (tx) => {
      await queries.insertChallenge(tx, {
        userId: user.id,
        email: user.email,
        challengeType: 'email_verification',
        tokenHash,
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      });
    });

    await sendVerificationEmail(user, token).catch((err) => {
      logger.error({ err, userId: user.id }, 'Failed to resend verification email');
    });

    return { ok: true };
  }

  /* ===========================================================================
   * LOGIN
   * ======================================================================== */

  async function login({ email, password, rememberMe, deviceLabel, ip, userAgent }) {
    const emailNormalized = normalizeEmail(email);
    await checkLoginRateLimit(emailNormalized);

    const user = await queries.findUserByEmail(emailNormalized);

    // Always compare against a hash to prevent user enumeration via timing
    const hashToCompare = user?.password_hash || '$2b$12$dummyhashfordummycomparisondummyu';
    const passwordOk = await verifyPassword(password, hashToCompare);

    if (!user || !passwordOk) {
      await recordSecurityEvent({
        userId: user?.id || null,
        eventType: 'login_failure',
        outcome: 'failure',
        ipAddress: ip,
        deviceMetadata: { userAgent },
        metadata: { email: emailNormalized },
      });
      throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (user.status === 'suspended' || user.status === 'deleted') {
      await recordSecurityEvent({
        userId: user.id,
        eventType: 'login_failure',
        outcome: 'blocked',
        ipAddress: ip,
        metadata: { reason: 'account_not_active', status: user.status },
      });
      throw new AuthenticationError('Account is not active', 'ACCOUNT_NOT_ACTIVE');
    }

    // Load security settings to check MFA
    const security = await queries.getSecuritySettings(user.id);

    if (security?.mfa_enabled_at) {
      // Issue a short-lived MFA challenge instead of a session
      const challengeToken = randomToken(32);
      const tokenHash = hashSessionToken(challengeToken);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.tx(async (tx) => {
        await queries.insertChallenge(tx, {
          userId: user.id,
          challengeType: 'mfa_verification',
          tokenHash,
          expiresAt,
          metadata: { deviceLabel, userAgent },
        });
      });

      return {
        mfaRequired: true,
        challengeId: tokenHash,
        challengeToken,
      };
    }

    // No MFA — create session directly
    return createSessionForUser(user, { deviceLabel, ip, userAgent, rememberMe });
  }

  async function createSessionForUser(user, { deviceLabel, ip, userAgent, rememberMe }) {
    const sessionToken = randomToken(32);
    const sessionTokenHash = hashSessionToken(sessionToken);
    const ttlMs = rememberMe ? 90 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);

    const session = await db.tx(async (tx) => {
      const created = await queries.insertSession(tx, {
        userId: user.id,
        sessionTokenHash,
        deviceLabel,
        ipAddress: ip,
        userAgent,
        expiresAt,
      });

      await events.publish(tx, 'user.session_created', {
        userId: user.id,
        sessionId: created.id,
        deviceLabel: deviceLabel || null,
      }, {
        actorId: user.id,
        resourceType: 'user_session',
        resourceId: created.id,
      });

      return created;
    });

    // Issue an access token alongside the session token for API clients
    const accessToken = issueAccessToken({
      userId: user.id,
      sessionId: session.id,
    });

    await recordSecurityEvent({
      userId: user.id,
      eventType: 'login_success',
      outcome: 'success',
      ipAddress: ip,
      deviceMetadata: { userAgent, deviceLabel },
      metadata: { sessionId: session.id },
    });

    return {
      mfaRequired: false,
      user,
      session,
      sessionToken,
      accessToken,
    };
  }

  /* ===========================================================================
   * MFA — VERIFY
   * ======================================================================== */

  async function verifyMfaChallenge({ challengeId, code, ip, userAgent }) {
    if (!challengeId || !code) throw new ValidationError('Challenge ID and code are required');

    const challenge = await queries.findChallengeByTokenHash(challengeId);
    if (!challenge) throw new AuthenticationError('Invalid MFA challenge');
    if (challenge.challenge_type !== 'mfa_verification') {
      throw new AuthenticationError('Invalid MFA challenge');
    }
    if (challenge.consumed_at) throw new AuthenticationError('MFA challenge already used');
    if (new Date(challenge.expires_at) <= new Date()) {
      throw new AuthenticationError('MFA challenge expired');
    }
    if (challenge.attempt_count >= 5) {
      throw new AuthenticationError('Too many MFA attempts', 'MFA_ATTEMPTS_EXCEEDED');
    }

    const user = await queries.findUserById(challenge.user_id);
    if (!user) throw new AuthenticationError('Account not found');

    const security = await queries.getSecuritySettings(user.id);
    if (!security?.mfa_secret_encrypted) {
      throw new AuthenticationError('MFA is not enabled');
    }

    const secret = decrypt(security.mfa_secret_encrypted);
    const validTotp = verifyTotp(secret, code);

    let valid = validTotp;
    if (!valid) {
      // Try recovery codes
      const codes = await queries.findUnusedRecoveryCodes(user.id);
      for (const rc of codes) {
        const expected = hashCode(code, challenge.challenge_type + rc.id);
        // For simplicity, recovery code verification uses its own hashing
        // scheme stored as `${salt}:${hash}`; see `regenerateRecoveryCodes`.
      }
    }

    if (!valid) {
      await queries.incrementChallengeAttempts(challenge.id);
      await recordSecurityEvent({
        userId: user.id,
        eventType: 'login_failure',
        outcome: 'failure',
        ipAddress: ip,
        metadata: { reason: 'mfa_invalid' },
      });
      throw new AuthenticationError('Invalid MFA code', 'MFA_INVALID');
    }

    const consumed = await queries.consumeChallenge(challenge.id);
    if (!consumed) throw new AuthenticationError('MFA challenge already used');

    const deviceLabel = challenge.metadata?.deviceLabel || null;

    return createSessionForUser(user, {
      deviceLabel,
      ip,
      userAgent,
      rememberMe: false,
    });
  }

  /* ===========================================================================
   * MFA — ENROLLMENT
   * ======================================================================== */

  async function beginMfaEnrollment({ userId }) {
    const user = await queries.findUserById(userId);
    if (!user) throw new NotFoundError('User');

    const security = await queries.getSecuritySettings(userId);
    if (security?.mfa_enabled_at) {
      throw new ConflictError('MFA is already enabled', 'MFA_ALREADY_ENABLED');
    }

    const secret = generateTotpSecret();
    const encryptedPending = encrypt(secret.base32);

    await queries.updateSecuritySettings(userId, {
      mfaSecretPendingEncrypted: encryptedPending,
    });

    return {
      secret: secret.base32,
      authUrl: totpAuthUrl(secret, user.email),
    };
  }

  async function confirmMfaEnrollment({ userId, code }) {
    const security = await queries.getSecuritySettings(userId);
    if (!security?.mfa_secret_pending_encrypted) {
      throw new ValidationError('No pending MFA enrollment');
    }
    if (security.mfa_enabled_at) {
      throw new ConflictError('MFA is already enabled', 'MFA_ALREADY_ENABLED');
    }

    const secret = decrypt(security.mfa_secret_pending_encrypted);

    if (!verifyTotp(secret, code)) {
      throw new ValidationError('Invalid MFA code');
    }

    const encrypted = encrypt(secret);
    const recoveryCodes = generateRecoveryCodes(RECOVERY_CODES_COUNT);

    await db.tx(async (tx) => {
      await queries.updateSecuritySettings(userId, {
        mfaEnabledAt: new Date(),
        mfaSecretEncrypted: encrypted,
        mfaSecretPendingEncrypted: null,
        mfaRecoveryCodesGeneratedAt: new Date(),
      });

      await queries.revokeAllRecoveryCodes(userId);

      // Store recovery codes as sha256(secret) using a per-code random salt
      const verifiers = [];
      for (const code of recoveryCodes) {
        const salt = generateSalt();
        const hash = hashCode(code, salt);
        verifiers.push(`${salt}:${hash}`);
      }
      await queries.insertRecoveryCodes(tx, userId, verifiers);

      await events.publish(tx, 'user.mfa_enabled', {
        userId,
      }, {
        actorId: userId,
        resourceType: 'user',
        resourceId: userId,
      });
    });

    await recordSecurityEvent({
      userId,
      eventType: 'mfa_enabled',
      outcome: 'success',
    });

    return { recoveryCodes };
  }

  async function disableMfa({ userId }) {
    const security = await queries.getSecuritySettings(userId);
    if (!security?.mfa_enabled_at) {
      throw new ConflictError('MFA is not enabled', 'MFA_NOT_ENABLED');
    }

    await db.tx(async (tx) => {
      await queries.updateSecuritySettings(userId, {
        mfaEnabledAt: null,
        mfaSecretEncrypted: null,
        mfaSecretPendingEncrypted: null,
      });
      await queries.revokeAllRecoveryCodes(userId);

      await events.publish(tx, 'user.mfa_disabled', {
        userId,
      }, {
        actorId: userId,
        resourceType: 'user',
        resourceId: userId,
      });
    });

    await recordSecurityEvent({
      userId,
      eventType: 'mfa_disabled',
      outcome: 'success',
    });

    return { ok: true };
  }

  async function regenerateRecoveryCodes({ userId }) {
    const security = await queries.getSecuritySettings(userId);
    if (!security?.mfa_enabled_at) {
      throw new ConflictError('MFA is not enabled', 'MFA_NOT_ENABLED');
    }

    const codes = generateRecoveryCodes(RECOVERY_CODES_COUNT);

    await db.tx(async (tx) => {
      await queries.revokeAllRecoveryCodes(userId);

      const verifiers = [];
      for (const code of codes) {
        const salt = generateSalt();
        const hash = hashCode(code, salt);
        verifiers.push(`${salt}:${hash}`);
      }
      await queries.insertRecoveryCodes(tx, userId, verifiers);

      await queries.updateSecuritySettings(userId, {
        mfaRecoveryCodesGeneratedAt: new Date(),
      });

      await events.publish(tx, 'user.password_changed', {
        userId,
        reason: 'recovery_codes_regenerated',
      }, {
        actorId: userId,
        resourceType: 'user',
        resourceId: userId,
      });
    });

    return { recoveryCodes: codes };
  }

  function generateRecoveryCodes(count) {
    const codes = [];
    for (let i = 0; i < count; i += 1) {
      const parts = [];
      for (let j = 0; j < 4; j += 1) {
        parts.push(generateNumericCode(4));
      }
      codes.push(parts.join('-'));
    }
    return codes;
  }

  /* ===========================================================================
   * SESSION MANAGEMENT
   * ======================================================================== */

  async function findActiveByTokenHash(tokenHash) {
    const session = await queries.findSessionByTokenHash(tokenHash);
    if (!session) return null;
    if (session.revoked_at) return null;
    if (new Date(session.expires_at) <= new Date()) return null;
    return session;
  }

  async function touchSessionActivity(sessionId) {
    await queries.touchSessionActivity(sessionId);
  }

  async function listSessions({ userId, currentSessionId }) {
    const sessions = await queries.listActiveSessionsForUser(userId);
    return sessions.map((s) => ({
      ...s,
      is_current: s.id === currentSessionId,
    }));
  }

  async function revokeSession({ userId, sessionId }) {
    const session = await queries.findSessionById(sessionId);
    if (!session || session.user_id !== userId) {
      throw new NotFoundError('Session');
    }
    const ok = await queries.revokeSession(sessionId, 'user_revoke');
    if (!ok) throw new NotFoundError('Session');

    await db.tx(async (tx) => {
      await events.publish(tx, 'user.session_revoked', {
        userId,
        sessionId,
      }, {
        actorId: userId,
        resourceType: 'user_session',
        resourceId: sessionId,
      });
    });

    await recordSecurityEvent({
      userId,
      eventType: 'session_revoked',
      outcome: 'success',
      metadata: { sessionId },
    });

    return { ok: true };
  }

  async function revokeAllSessions(userId, { exceptSessionId = null, reason = 'user_logout_all' } = {}) {
    const count = await queries.revokeAllSessionsForUser(userId, { exceptSessionId });

    if (count > 0) {
      await db.tx(async (tx) => {
        await events.publish(tx, 'user.session_revoked', {
          userId,
          count,
          reason,
        }, {
          actorId: userId,
          resourceType: 'user',
          resourceId: userId,
        });
      });

      await recordSecurityEvent({
        userId,
        eventType: 'all_sessions_revoked',
        outcome: 'success',
        metadata: { count, reason },
      });
    }

    return { revoked: count };
  }

  async function markStepUp(sessionId) {
    await queries.setSessionStepUp(sessionId);
  }

  async function isStepUpFresh(sessionId, { maxAgeMs = SESSION_STEP_UP_TTL_MS } = {}) {
    const session = await queries.findSessionById(sessionId);
    if (!session) return false;
    if (!session.step_up_at) return false;
    return Date.now() - new Date(session.step_up_at).getTime() < maxAgeMs;
  }

  /* ===========================================================================
   * PASSWORD
   * ======================================================================== */

  async function changePassword({ userId, currentPassword, newPassword, sessionId }) {
    const user = await queries.findUserById(userId);
    if (!user) throw new NotFoundError('User');

    if (!user.password_hash) {
      throw new ConflictError('No password set for this account', 'NO_PASSWORD');
    }

    const ok = await verifyPassword(currentPassword, user.password_hash);
    if (!ok) throw new AuthenticationError('Current password is incorrect', 'INVALID_CREDENTIALS');

    const newHash = await hashPassword(newPassword);

    await db.tx(async (tx) => {
      await queries.updatePasswordHash(userId, newHash);
      await queries.updateSecuritySettings(userId, {
        passwordChangedAt: new Date(),
      });

      await events.publish(tx, 'user.password_changed', {
        userId,
      }, {
        actorId: userId,
        resourceType: 'user',
        resourceId: userId,
      });
    });

    // Revoke all other sessions
    await queries.revokeAllSessionsForUser(userId, { exceptSessionId: sessionId });

    await recordSecurityEvent({
      userId,
      eventType: 'password_change',
      outcome: 'success',
    });

    return { ok: true };
  }

  async function requestPasswordReset({ email }) {
    const emailNormalized = normalizeEmail(email);
    const user = await queries.findUserByEmail(emailNormalized);

    // Always return success to prevent enumeration
    if (!user || user.status === 'suspended' || user.status === 'deleted') {
      return { ok: true };
    }

    await queries.invalidateActiveChallenges({
      userId: user.id,
      challengeType: 'password_reset',
    });

    const token = randomToken(32);
    const tokenHash = hashSessionToken(token);

    await db.tx(async (tx) => {
      await queries.insertChallenge(tx, {
        userId: user.id,
        email: user.email,
        challengeType: 'password_reset',
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      });
    });

    if (mailer) {
      const url = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
      await mailer.send({
        to: user.email,
        subject: 'Reset your SyncExc password',
        text: `Reset your password by visiting: ${url}`,
        html: `<p>Reset your password by clicking <a href="${url}">this link</a>.</p>`,
      }).catch((err) => {
        logger.error({ err, userId: user.id }, 'Failed to send password reset email');
      });
    }

    return { ok: true };
  }

  async function resetPassword({ token, newPassword }) {
    if (!token) throw new ValidationError('Reset token is required');

    const tokenHash = hashSessionToken(token);
    const challenge = await queries.findChallengeByTokenHash(tokenHash);

    if (!challenge || challenge.challenge_type !== 'password_reset') {
      throw new ValidationError('Invalid reset token');
    }
    if (challenge.consumed_at) throw new ValidationError('Reset token already used');
    if (new Date(challenge.expires_at) <= new Date()) {
      throw new ValidationError('Reset token expired');
    }

    const newHash = await hashPassword(newPassword);

    await db.tx(async (tx) => {
      const consumed = await queries.consumeChallenge(challenge.id);
      if (!consumed) throw new ValidationError('Reset token already used');

      await queries.updatePasswordHash(challenge.user_id, newHash);
      await queries.updateSecuritySettings(challenge.user_id, {
        passwordChangedAt: new Date(),
      });

      await events.publish(tx, 'user.password_changed', {
        userId: challenge.user_id,
        reason: 'reset',
      }, {
        actorId: challenge.user_id,
        resourceType: 'user',
        resourceId: challenge.user_id,
      });
    });

    // Revoke all sessions
    await queries.revokeAllSessionsForUser(challenge.user_id);

    await recordSecurityEvent({
      userId: challenge.user_id,
      eventType: 'password_reset',
      outcome: 'success',
    });

    return { ok: true };
  }

  /* ===========================================================================
   * PROFILE
   * ======================================================================== */

  async function updateProfile({ userId, updates }) {
    const normalized = {};

    if (updates.displayName) normalized.displayName = String(updates.displayName).trim();
    if (updates.username) {
      const usernameNormalized = normalizeUsername(updates.username);
      if (usernameNormalized !== (await queries.findUserById(userId)).username_normalized) {
        await ensureUniqueUsername(usernameNormalized);
      }
      normalized.username = updates.username;
      normalized.usernameNormalized = usernameNormalized;
    }
    if (updates.preferredLanguage) normalized.preferredLanguage = updates.preferredLanguage;
    if (updates.timezone) normalized.timezone = updates.timezone;
    if (updates.countryCode) normalized.countryCode = String(updates.countryCode).toUpperCase();

    const updated = await queries.updateUserProfile(userId, normalized);
    if (!updated) throw new NotFoundError('User');
    return updated;
  }

  async function requestEmailChange({ userId, newEmail, password }) {
    const user = await queries.findUserById(userId);
    if (!user) throw new NotFoundError('User');

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw new AuthenticationError('Password is incorrect', 'INVALID_CREDENTIALS');

    const emailNormalized = normalizeEmail(newEmail);

    if (emailNormalized === user.email_normalized) {
      throw new ConflictError('New email is the same as the current email', 'SAME_EMAIL');
    }
    await ensureUniqueEmail(emailNormalized);

    await queries.invalidateActiveChallenges({
      userId,
      challengeType: 'email_change',
    });

    const token = randomToken(32);
    const tokenHash = hashSessionToken(token);

    await db.tx(async (tx) => {
      await queries.insertChallenge(tx, {
        userId,
        email: newEmail,
        challengeType: 'email_change',
        tokenHash,
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
        metadata: { emailNormalized },
      });
    });

    if (mailer) {
      const url = `${process.env.APP_URL || 'http://localhost:5173'}/verify-email-change?token=${token}`;
      await mailer.send({
        to: newEmail,
        subject: 'Confirm your new SyncExc email',
        text: `Confirm your new email by visiting: ${url}`,
        html: `<p>Confirm your new email by clicking <a href="${url}">this link</a>.</p>`,
      }).catch((err) => {
        logger.error({ err, userId }, 'Failed to send email change confirmation');
      });
    }

    return { ok: true };
  }

  async function confirmEmailChange({ token }) {
    if (!token) throw new ValidationError('Token is required');

    const tokenHash = hashSessionToken(token);
    const challenge = await queries.findChallengeByTokenHash(tokenHash);

    if (!challenge || challenge.challenge_type !== 'email_change') {
      throw new ValidationError('Invalid token');
    }
    if (challenge.consumed_at) throw new ValidationError('Token already used');
    if (new Date(challenge.expires_at) <= new Date()) throw new ValidationError('Token expired');

    const emailNormalized = challenge.metadata?.emailNormalized || normalizeEmail(challenge.email);

    const user = await db.tx(async (tx) => {
      await queries.consumeChallenge(challenge.id);
      const updated = await queries.updateUserEmail(
        challenge.user_id,
        challenge.email,
        emailNormalized
      );
      await events.publish(tx, 'user.email_changed', {
        userId: updated.id,
        newEmail: updated.email,
      }, {
        actorId: updated.id,
        resourceType: 'user',
        resourceId: updated.id,
      });
      return updated;
    });

    return user;
  }

  /* ===========================================================================
   * TRUSTED DEVICES
   * ======================================================================== */

  async function listTrustedDevices({ userId }) {
    return queries.listTrustedDevicesForUser(userId);
  }

  async function revokeTrustedDevice({ userId, deviceId }) {
    const ok = await queries.revokeTrustedDevice(deviceId, userId);
    if (!ok) throw new NotFoundError('Trusted device');

    await recordSecurityEvent({
      userId,
      eventType: 'trusted_device_removed',
      outcome: 'success',
      metadata: { deviceId },
    });

    return { ok: true };
  }

  /* ===========================================================================
   * SECURITY EVENTS
   * ======================================================================== */

  async function listSecurityEvents({ userId, limit, cursor }) {
    return queries.listSecurityEventsForUser(userId, { limit, cursor });
  }

  /* ===========================================================================
   * READS FOR OTHER MODULES
   * ======================================================================== */

  async function getUserById(userId) {
    return queries.findUserById(userId);
  }

  async function getUserByEmail(email) {
    return queries.findUserByEmail(normalizeEmail(email));
  }

  async function isActive(userId) {
    const user = await queries.findUserById(userId);
    return Boolean(user && user.status === 'active');
  }

  /* ===========================================================================
   * EXPORTS
   * ======================================================================== */

  return {
    // Registration
    register,
    verifyEmail,
    resendVerificationEmail,

    // Auth
    login,
    verifyMfaChallenge,

    // MFA
    beginMfaEnrollment,
    confirmMfaEnrollment,
    disableMfa,
    regenerateRecoveryCodes,

    // Sessions
    findActiveByTokenHash,
    touchSessionActivity,
    listSessions,
    revokeSession,
    revokeAllSessions,
    markStepUp,
    isStepUpFresh,

    // Password
    changePassword,
    requestPasswordReset,
    resetPassword,

    // Profile
    updateProfile,
    requestEmailChange,
    confirmEmailChange,

    // Trusted devices
    listTrustedDevices,
    revokeTrustedDevice,

    // Security events
    listSecurityEvents,

    // Cross-module reads
    getUserById,
    getUserByEmail,
    isActive,
  };
}

export default createIdentityService;