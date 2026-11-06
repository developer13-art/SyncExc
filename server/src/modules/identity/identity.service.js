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
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
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
  RateLimitError,
} from '../../lib/errors.js';
import config from '../../config.js';
import {
  buildVerificationEmail,
  buildEmailChangeEmail,
  buildPasswordResetEmail,
  buildSecurityAlertEmail,
} from '../../lib/email-templates.js';

const MAX_LOGIN_ATTEMPTS_PER_WINDOW = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const VERIFICATION_TOKEN_TTL_MS = config.email.verificationTokenTtlMs;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const DEVICE_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const RECOVERY_CODES_COUNT = 10;
const SESSION_STEP_UP_TTL_MS = 15 * 60 * 1000;

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export { hashSessionToken };

function hashWebAuthnChallenge(challenge) {
  return hashSessionToken(challenge);
}

function getClientChallenge(response) {
  try {
    const encoded = response?.response?.clientDataJSON;
    if (typeof encoded !== 'string') return null;
    const data = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return typeof data.challenge === 'string' ? data.challenge : null;
  } catch {
    return null;
  }
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username).trim().toLowerCase();
}

export function createIdentityService({ db, queries, rateLimiter, mailer, push, events, audit, profileImages, logger, referralAttribution }) {
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
    const count = rateLimiter.incrementWithTtl(key, LOGIN_WINDOW_SECONDS);
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

  async function createMfaChallengeForUser(user, { deviceLabel, userAgent }) {
    const challengeToken = randomToken(32);
    const tokenHash = hashSessionToken(challengeToken);
    await db.tx(async (tx) => {
      await queries.insertChallenge(tx, {
        userId: user.id,
        challengeType: 'mfa_verification',
        tokenHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        metadata: { deviceLabel, userAgent },
      });
    });
    return { mfaRequired: true, challengeToken };
  }

  /* ===========================================================================
   * REGISTRATION
   * ======================================================================== */

  async function register({ email, password, username, displayName, preferredLanguage, timezone, termsVersion, privacyVersion, referralCode, ip, userAgent }, context = {}) {
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

    // Send verification email outside the transaction. A send failure must
    // never roll back the account: the user can request a new link from the
    // verification screen or their profile.
    let verificationEmail = { status: 'failed', errorCategory: 'unknown' };
    try {
      verificationEmail = await sendVerificationEmail(result.user, result.verificationToken);
    } catch (err) {
      logger.error(
        { userId: result.user.id, errorCategory: err?.errorCategory || err?.code || 'unknown' },
        'Failed to send verification email'
      );
      await recordSecurityEvent({
        userId: result.user.id,
        eventType: 'email_delivery_failed',
        outcome: 'failure',
        metadata: { emailType: 'email_verification', errorCategory: err?.errorCategory || err?.code || 'unknown' },
      });
      verificationEmail = {
        status: 'failed',
        errorCategory: err?.errorCategory || err?.code || 'unknown',
      };
    }

    await recordSecurityEvent({
      userId: result.user.id,
      eventType: 'login_success', // placeholder for account creation
      outcome: 'success',
      ipAddress: ip,
      deviceMetadata: { userAgent },
      metadata: { action: 'account_created' },
    });

    if (referralCode && referralAttribution) {
      try {
        await referralAttribution({
          userId: result.user.id,
          referralCode: String(referralCode).trim().toUpperCase(),
          ipAddress: ip,
          userAgent,
        });
      } catch (err) {
        logger?.error?.({ err, userId: result.user.id }, 'Failed to attribute referral registration');
      }
    }

    return { user: result.user, verificationEmail };
  }

  async function sendVerificationEmail(user, token) {
    const url = new URL('/verify-email', config.app.url);
    url.searchParams.set('token', token);
    const template = buildVerificationEmail({
      recipientName: user.display_name || user.username,
      verifyUrl: url.toString(),
      expiresHours: VERIFICATION_TOKEN_TTL_MS / 3_600_000,
    });
    const result = await mailer.send({
      to: user.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
      emailType: 'email_verification',
      userId: user.id,
      metadata: { purpose: 'email_verification' },
    });
    return {
      status: 'accepted',
      deliveryId: result?.deliveryId || null,
      expiresInHours: VERIFICATION_TOKEN_TTL_MS / 3_600_000,
    };
  }

  /* ===========================================================================
   * EMAIL VERIFICATION
   * ======================================================================== */

  async function verifyEmail({ token }) {
    if (!token) throw new ValidationError('Verification token is required');

    const tokenHash = hashSessionToken(token);
    const challenge = await queries.findChallengeByTokenHash(tokenHash);

    if (!challenge || challenge.challenge_type !== 'email_verification' || !challenge.user_id) {
      throw new ValidationError('Invalid verification link', { reason: 'invalid' });
    }
    if (challenge.consumed_at) {
      const user = await queries.findUserById(challenge.user_id);
      if (user?.email_verified_at) {
        return { status: 'already_verified', user };
      }
      throw new ValidationError('This verification link has already been used', { reason: 'used' });
    }
    if (new Date(challenge.expires_at) <= new Date()) {
      throw new ValidationError('This verification link has expired', { reason: 'expired' });
    }

    const result = await db.tx(async (tx) => {
      const consumed = await queries.consumeChallenge(challenge.id, tx);
      if (!consumed) throw new ValidationError('This verification link is invalid or has expired', { reason: 'invalid' });

      const user = await queries.markEmailVerified(challenge.user_id, challenge.email, tx);
      if (!user) {
        throw new ValidationError('This verification link is no longer valid', { reason: 'invalid' });
      }

      await events.publish(tx, 'user.email_verified', {
        userId: user.id,
        email: user.email,
      }, {
        actorId: user.id,
        resourceType: 'user',
        resourceId: user.id,
      });

      return { status: 'verified', user };
    });

    await recordSecurityEvent({
      userId: result.user.id,
      eventType: 'email_verified',
      outcome: 'success',
    });

    return result;
  }

  async function resendVerificationEmail({ email, userId, ip }) {
    const emailNormalized = email ? normalizeEmail(email) : null;
    const expiresInHours = VERIFICATION_TOKEN_TTL_MS / 3_600_000;
    if (ip) {
      const ipAttempts = rateLimiter.incrementWithTtl(`auth:verification-resend:ip:${ip}`, 60 * 60);
      if (ipAttempts > 10) {
        throw new RateLimitError('Too many verification requests. Please try again later.', 60 * 60);
      }
    }

    const user = userId
      ? await queries.findUserById(userId)
      : emailNormalized
        ? await queries.findUserByEmail(emailNormalized)
        : null;

    if (!user) return { ok: true, emailSent: null, expiresInHours };
    if (user.email_verified_at) {
      return userId
        ? { ok: true, alreadyVerified: true, emailSent: false, expiresInHours }
        : { ok: true, emailSent: null, expiresInHours };
    }

    // Per-account cooldown so a single account cannot be spammed with links
    const cooldownKey = `auth:email-verification-resend:${user.id}`;
    const attempts = rateLimiter.incrementWithTtl(
      cooldownKey,
      config.email.resendCooldownSeconds
    );
    if (attempts > 1) {
      if (!userId) return { ok: true, emailSent: null, expiresInHours };
      throw new RateLimitError(
        'A verification email was sent recently. Please wait before requesting another.',
        config.email.resendCooldownSeconds
      );
    }

    // Supersede any existing verification challenges (single usable token)
    const token = randomToken(32);
    const tokenHash = hashSessionToken(token);

    await db.tx(async (tx) => {
      await queries.invalidateActiveChallenges({
        userId: user.id,
        challengeType: 'email_verification',
      }, tx);
      await queries.insertChallenge(tx, {
        userId: user.id,
        email: user.email,
        challengeType: 'email_verification',
        tokenHash,
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      });
    });

    try {
      const sent = await sendVerificationEmail(user, token);
      return {
        ok: true,
        emailSent: userId ? true : null,
        expiresInHours,
        ...(userId ? { requestStatus: sent.status } : {}),
        ...(userId ? { resendCooldownSeconds: config.email.resendCooldownSeconds } : {}),
      };
    } catch (err) {
      logger.error(
        { userId: user.id, errorCategory: err?.errorCategory || err?.code || 'unknown' },
        'Failed to resend verification email'
      );
      await recordSecurityEvent({
        userId: user.id,
        eventType: 'email_delivery_failed',
        outcome: 'failure',
        ipAddress: ip,
        metadata: { emailType: 'email_verification', errorCategory: err?.errorCategory || err?.code || 'unknown' },
      });
      return {
        ok: true,
        emailSent: userId ? false : null,
        expiresInHours,
        ...(userId ? {
          errorCategory: err?.errorCategory || err?.code || 'unknown',
          resendCooldownSeconds: config.email.resendCooldownSeconds,
        } : {}),
      };
    }
  }

  async function getEmailVerificationStatus({ userId }) {
    const user = await queries.findUserById(userId);
    if (!user) throw new NotFoundError('User');
    return {
      email: user.email,
      emailVerified: Boolean(user.email_verified_at),
      verifiedAt: user.email_verified_at || null,
    };
  }

  function ensureWebAuthnEnabled() {
    if (!config.webauthn.enabled) {
      throw new AppError('Passkey authentication is currently unavailable', {
        code: 'PASSKEYS_DISABLED',
        status: 503,
        expose: true,
      });
    }
  }

  async function beginPasskeyRegistration({ userId, ip, userAgent }) {
    ensureWebAuthnEnabled();
    const user = await queries.findUserById(userId);
    if (!user) throw new NotFoundError('User');

    const existing = await queries.listPasskeyCredentials(userId);
    const options = await generateRegistrationOptions({
      rpName: config.webauthn.rpName,
      rpID: config.webauthn.rpId,
      userID: Buffer.from(user.id, 'utf8'),
      userName: user.email,
      userDisplayName: user.display_name || user.username,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      excludeCredentials: existing.map((credential) => ({
        id: credential.credential_id,
        transports: credential.transports || undefined,
      })),
    });

    await db.tx((tx) =>
      queries.insertWebAuthnChallenge(tx, {
        userId,
        ceremony: 'registration',
        challengeHash: hashWebAuthnChallenge(options.challenge),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        ip,
        userAgent,
      })
    );

    return options;
  }

  async function finishPasskeyRegistration({ userId, response, name, ip, userAgent }) {
    ensureWebAuthnEnabled();
    const suppliedChallenge = getClientChallenge(response);
    if (!suppliedChallenge || !response?.id) {
      throw new ValidationError('The passkey response is invalid');
    }
    const challenge = await queries.findWebAuthnChallenge(
      hashWebAuthnChallenge(suppliedChallenge),
      'registration'
    );
    if (
      !challenge ||
      challenge.user_id !== userId ||
      challenge.consumed_at ||
      new Date(challenge.expires_at) <= new Date()
    ) {
      throw new ValidationError('The passkey setup has expired. Start again.', { reason: 'challenge_invalid' });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: (value) => hashWebAuthnChallenge(value) === challenge.challenge,
        expectedOrigin: config.webauthn.origin,
        expectedRPID: config.webauthn.rpId,
        requireUserVerification: true,
      });
    } catch (err) {
      logger.warn(
        { userId, errorName: err?.name || 'Error' },
        'Passkey registration response rejected'
      );
      throw new ValidationError('The device could not be verified. Please try again.');
    }

    if (!verification.verified || !verification.registrationInfo?.credential) {
      throw new ValidationError('The device could not be verified. Please try again.');
    }

    const { credential, credentialDeviceType, credentialBackedUp, fmt } =
      verification.registrationInfo;
    let passkey;
    try {
      passkey = await db.tx(async (tx) => {
        const consumed = await queries.consumeWebAuthnChallenge(tx, challenge.id);
        if (!consumed) {
          throw new ValidationError('The passkey setup has expired. Start again.', { reason: 'challenge_invalid' });
        }
        return queries.insertPasskey(tx, {
          userId,
          name: String(name || 'This device').trim().slice(0, 64) || 'This device',
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          attestationType: fmt,
          transports: response.response?.transports || [],
          signCount: credential.counter,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          registeredIp: ip,
          userAgent,
        });
      });
    } catch (err) {
      if (err?.code === '23505') {
        throw new ConflictError('This passkey is already registered', 'PASSKEY_ALREADY_REGISTERED');
      }
      throw err;
    }

    await recordSecurityEvent({
      userId,
      eventType: 'passkey_registered',
      outcome: 'success',
      ipAddress: ip,
      deviceMetadata: { userAgent, passkeyId: passkey.id },
    });

    return passkey;
  }

  async function beginPasskeyAuthentication({ ip, userAgent }) {
    ensureWebAuthnEnabled();
    const options = await generateAuthenticationOptions({
      rpID: config.webauthn.rpId,
      userVerification: 'required',
    });
    await db.tx((tx) =>
      queries.insertWebAuthnChallenge(tx, {
        userId: null,
        ceremony: 'discoverable_authentication',
        challengeHash: hashWebAuthnChallenge(options.challenge),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        ip,
        userAgent,
      })
    );
    return options;
  }

  async function finishPasskeyAuthentication({ response, ip, userAgent }) {
    ensureWebAuthnEnabled();
    const suppliedChallenge = getClientChallenge(response);
    const credentialId = response?.id;
    if (!suppliedChallenge || typeof credentialId !== 'string') {
      throw new AuthenticationError('Passkey sign-in could not be verified', 'PASSKEY_INVALID');
    }

    const [challenge, passkey] = await Promise.all([
      queries.findWebAuthnChallenge(
        hashWebAuthnChallenge(suppliedChallenge),
        'discoverable_authentication'
      ),
      queries.findPasskeyByCredentialId(credentialId),
    ]);
    if (
      !challenge ||
      challenge.consumed_at ||
      new Date(challenge.expires_at) <= new Date() ||
      !passkey
    ) {
      await recordSecurityEvent({
        userId: passkey?.user_id || null,
        eventType: 'passkey_login_failure',
        outcome: 'failure',
        ipAddress: ip,
      });
      throw new AuthenticationError('Passkey sign-in could not be verified', 'PASSKEY_INVALID');
    }

    const user = await queries.findUserById(passkey.user_id);
    if (!user || user.status === 'suspended' || user.status === 'deleted') {
      throw new AuthenticationError('Passkey sign-in could not be verified', 'PASSKEY_INVALID');
    }

    const expectedUserHandle = Buffer.from(user.id, 'utf8').toString('base64url');
    if (response.response?.userHandle !== expectedUserHandle) {
      throw new AuthenticationError('Passkey sign-in could not be verified', 'PASSKEY_INVALID');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: (value) => hashWebAuthnChallenge(value) === challenge.challenge,
        expectedOrigin: config.webauthn.origin,
        expectedRPID: config.webauthn.rpId,
        requireUserVerification: true,
        credential: {
          id: passkey.credential_id,
          publicKey: passkey.public_key,
          counter: Number(passkey.sign_count),
          transports: passkey.transports || undefined,
        },
      });
    } catch (err) {
      logger.warn(
        { userId: user.id, errorName: err?.name || 'Error' },
        'Passkey authentication response rejected'
      );
      await recordSecurityEvent({
        userId: user.id,
        eventType: 'passkey_login_failure',
        outcome: 'failure',
        ipAddress: ip,
      });
      throw new AuthenticationError('Passkey sign-in could not be verified', 'PASSKEY_INVALID');
    }

    if (!verification.verified) {
      throw new AuthenticationError('Passkey sign-in could not be verified', 'PASSKEY_INVALID');
    }

    await db.tx(async (tx) => {
      const consumed = await queries.consumeWebAuthnChallenge(tx, challenge.id);
      if (!consumed) {
        throw new AuthenticationError('Passkey sign-in could not be verified', 'PASSKEY_INVALID');
      }
      const updated = await queries.updatePasskeyUsage(tx, {
        id: passkey.id,
        signCount: verification.authenticationInfo.newCounter,
        deviceType: verification.authenticationInfo.credentialDeviceType,
        backedUp: verification.authenticationInfo.credentialBackedUp,
      });
      if (!updated) {
        throw new AuthenticationError('Passkey sign-in could not be verified', 'PASSKEY_INVALID');
      }
    });

    const security = await queries.getSecuritySettings(user.id);
    if (security?.mfa_enabled_at) {
      const mfaChallenge = await createMfaChallengeForUser(user, {
        deviceLabel: `Passkey: ${passkey.name}`,
        userAgent,
      });
      await recordSecurityEvent({
        userId: user.id,
        eventType: 'passkey_factor_verified',
        outcome: 'success',
        ipAddress: ip,
        deviceMetadata: { userAgent, passkeyId: passkey.id },
      });
      return mfaChallenge;
    }

    const result = await createSessionForUser(user, {
      deviceLabel: `Passkey: ${passkey.name}`,
      ip,
      userAgent,
      rememberMe: false,
    });
    await recordSecurityEvent({
      userId: user.id,
      eventType: 'passkey_login_success',
      outcome: 'success',
      ipAddress: ip,
      deviceMetadata: { userAgent, passkeyId: passkey.id },
    });
    return result;
  }

  async function listPasskeys({ userId }) {
    ensureWebAuthnEnabled();
    return queries.listPasskeys(userId);
  }

  async function renamePasskey({ userId, passkeyId, name }) {
    const passkey = await queries.renamePasskey(userId, passkeyId, String(name).trim());
    if (!passkey) throw new NotFoundError('Passkey');
    return passkey;
  }

  async function removePasskey({ userId, passkeyId, ip }) {
    const removed = await queries.revokePasskey(userId, passkeyId);
    if (!removed) throw new NotFoundError('Passkey');
    await recordSecurityEvent({
      userId,
      eventType: 'passkey_removed',
      outcome: 'success',
      ipAddress: ip,
      deviceMetadata: { passkeyId },
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
      return createMfaChallengeForUser(user, { deviceLabel, userAgent });
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

  async function verifyMfaChallenge({ challengeToken, code, method = 'totp', ip, userAgent }) {
    if (!challengeToken || !code) throw new ValidationError('Challenge token and code are required');

    const challenge = await queries.findChallengeByTokenHash(hashSessionToken(challengeToken));
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
    let valid = method === 'totp' && verifyTotp(secret, code);
    let recoveryCodeId = null;
    if (method === 'recovery_code') {
      const codes = await queries.findUnusedRecoveryCodes(user.id);
      for (const rc of codes) {
        const [salt, expectedHash] = String(rc.code_verifier).split(':');
        if (salt && expectedHash && hashCode(code, salt) === expectedHash) {
          valid = true;
          recoveryCodeId = rc.id;
          break;
        }
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

    await db.tx(async (tx) => {
      const consumed = await queries.consumeChallenge(challenge.id, tx);
      if (!consumed) throw new AuthenticationError('MFA challenge already used');
      if (recoveryCodeId) {
        const marked = await queries.markRecoveryCodeUsed(recoveryCodeId, tx);
        if (!marked) throw new AuthenticationError('Recovery code already used');
      }
    });

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

  /**
   * Verify a step-up challenge (password or TOTP) for an already-authenticated
   * user. On success the caller marks the session as step-up verified.
   */
  async function verifyStepUp({ userId, method = 'password', code, ip = null, userAgent = null }) {
    if (!code || typeof code !== 'string') {
      throw new ValidationError('Verification code is required');
    }

    const user = await queries.findUserById(userId);
    if (!user) throw new AuthenticationError('Account not found');
    if (user.status !== 'active') {
      throw new AuthenticationError('Account is not active', 'ACCOUNT_NOT_ACTIVE');
    }

    let valid = false;
    if (method === 'password') {
      if (!user.password_hash) {
        throw new ConflictError('No password set for this account', 'NO_PASSWORD');
      }
      valid = await verifyPassword(code, user.password_hash);
    } else if (method === 'totp') {
      const security = await queries.getSecuritySettings(user.id);
      if (!security?.mfa_secret_encrypted) {
        throw new AuthenticationError('MFA is not enabled for this account', 'MFA_NOT_ENABLED');
      }
      valid = verifyTotp(decrypt(security.mfa_secret_encrypted), code);
    } else {
      throw new ValidationError('Unsupported step-up method');
    }

    if (!valid) {
      await recordSecurityEvent({
        userId: user.id,
        eventType: 'step_up_failure',
        outcome: 'failure',
        ipAddress: ip,
        deviceMetadata: { userAgent },
        metadata: { method },
      });
      throw new AuthenticationError('Verification failed. Check your credentials and try again.', 'STEP_UP_INVALID');
    }

    await recordSecurityEvent({
      userId: user.id,
      eventType: 'step_up_success',
      outcome: 'success',
      ipAddress: ip,
      deviceMetadata: { userAgent },
      metadata: { method },
    });

    return { verified: true, method };
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

    sendSecurityAlert(user, {
      headline: 'Your password was changed',
      message: 'The password for your SyncExc account was just changed. All other sessions have been signed out.',
    });

    return { ok: true };
  }

  async function sendSecurityAlert(user, { headline, message }) {
    try {
      const template = buildSecurityAlertEmail({
        recipientName: user.display_name || user.username,
        headline,
        message,
        actionUrl: `${config.app.url}/settings/security`,
        actionLabel: 'Review account security',
      });
      await mailer.send({
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
        emailType: 'security_alert',
        userId: user.id,
        metadata: { headline },
      });
    } catch (err) {
      logger.error({ err, userId: user.id, errorCategory: err?.errorCategory }, 'Failed to send security alert email');
    }
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

    const url = `${config.app.url}/reset-password?token=${token}`;
    const template = buildPasswordResetEmail({
      recipientName: user.display_name || user.username,
      resetUrl: url,
      expiresMinutes: PASSWORD_RESET_TTL_MS / 60_000,
    });
    await mailer.send({
      to: user.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
      emailType: 'password_reset',
      userId: user.id,
      metadata: { purpose: 'password_reset' },
    }).catch((err) => {
      logger.error({ err, userId: user.id, errorCategory: err?.errorCategory }, 'Failed to send password reset email');
    });

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

  async function updateAvatar({ userId, file }) {
    const previous = await queries.findUserById(userId);
    if (!previous) throw new NotFoundError('User');
    const stored = await profileImages.upload(file);
    let updated;
    try {
      updated = await db.tx((tx) => queries.updateUserAvatar(userId, stored.url, tx));
      if (!updated) throw new NotFoundError('User');
    } catch (error) {
      try {
        await profileImages.remove(stored.url);
      } catch (cleanupError) {
        logger.error({ cleanupError, userId }, 'Could not clean up failed profile image upload');
      }
      throw error;
    }
    if (previous.avatar_url && previous.avatar_url !== stored.url) {
      try {
        await profileImages.remove(previous.avatar_url);
      } catch (error) {
        logger.error({ error, userId }, 'Could not remove replaced profile image');
      }
    }
    return updated;
  }

  async function removeAvatar({ userId }) {
    const previous = await queries.findUserById(userId);
    if (!previous) throw new NotFoundError('User');
    const updated = await db.tx((tx) => queries.updateUserAvatar(userId, null, tx));
    if (!updated) throw new NotFoundError('User');
    if (previous.avatar_url) {
      try {
        await profileImages.remove(previous.avatar_url);
      } catch (error) {
        logger.error({ error, userId }, 'Could not remove profile image');
      }
    }
    return updated;
  }

  async function getProfileImage(key) {
    return profileImages.get(key);
  }

  const DEFAULT_USER_PREFERENCES = Object.freeze({
    general: {
      theme: 'system',
    },
    trading: {
      defaultMarketType: 'spot',
      defaultOrderType: 'limit',
      defaultChartTimeframe: '1h',
      signalExecutionPercentage: null,
    },
  });

  async function getUserPreferences(userId) {
    const saved = await queries.getUserPreferences(userId);
    return {
      general: { ...DEFAULT_USER_PREFERENCES.general, ...(saved?.general_preferences || {}) },
      trading: { ...DEFAULT_USER_PREFERENCES.trading, ...(saved?.trading_preferences || {}) },
    };
  }

  async function updateUserPreferences({ userId, updates }) {
    const updated = await db.tx(async (tx) => {
      const preferences = await queries.upsertUserPreferences(userId, updates, tx);
      await events.publish(
        tx,
        'user.preferences_updated',
        { userId, sections: Object.keys(updates) },
        {
          actorId: userId,
          resourceType: 'user_preferences',
          resourceId: userId,
        },
      );
      return preferences;
    });
    return {
      general: { ...DEFAULT_USER_PREFERENCES.general, ...(updated?.general_preferences || {}) },
      trading: { ...DEFAULT_USER_PREFERENCES.trading, ...(updated?.trading_preferences || {}) },
    };
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

    const token = randomToken(32);
    const tokenHash = hashSessionToken(token);

    await db.tx(async (tx) => {
      await queries.invalidateActiveChallenges({
        userId,
        challengeType: 'email_change',
      }, tx);
      await queries.insertChallenge(tx, {
        userId,
        email: newEmail,
        challengeType: 'email_change',
        tokenHash,
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
        metadata: { emailNormalized },
      });
    });

    const url = new URL('/verify-email-change', config.app.url);
    url.searchParams.set('token', token);
    const template = buildEmailChangeEmail({
      recipientName: user.display_name || user.username,
      confirmUrl: url.toString(),
      expiresHours: VERIFICATION_TOKEN_TTL_MS / 3_600_000,
    });
    let emailSent = false;
    try {
      await mailer.send({
        to: newEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
        emailType: 'email_change',
        userId,
        metadata: { purpose: 'email_change' },
      });
      emailSent = true;
    } catch (err) {
      logger.error(
        { userId, errorCategory: err?.errorCategory || err?.code || 'unknown' },
        'Failed to send email change confirmation'
      );
      await recordSecurityEvent({
        userId,
        eventType: 'email_delivery_failed',
        outcome: 'failure',
        metadata: {
          emailType: 'email_change',
          errorCategory: err?.errorCategory || err?.code || 'unknown',
        },
      });
    }

    return { ok: true, emailSent };
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
      const consumed = await queries.consumeChallenge(challenge.id, tx);
      if (!consumed) throw new ValidationError('Email change link is invalid or expired');
      const updated = await queries.updateUserEmail(
        challenge.user_id,
        challenge.email,
        emailNormalized,
        tx,
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
    getEmailVerificationStatus,
    beginPasskeyRegistration,
    finishPasskeyRegistration,
    beginPasskeyAuthentication,
    finishPasskeyAuthentication,
    listPasskeys,
    renamePasskey,
    removePasskey,

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
    verifyStepUp,

    // Password
    changePassword,
    requestPasswordReset,
    resetPassword,

    // Profile
    updateProfile,
    updateAvatar,
    removeAvatar,
    getProfileImage,
    getUserPreferences,
    updateUserPreferences,
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