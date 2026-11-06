/**
 * SyncExc Server — Identity controllers
 *
 * Thin handlers that:
 *   - extract the caller's context (user, session, ip, user agent)
 *   - call the service
 *   - set the session cookie
 *   - shape the response
 *
 * No business logic. No direct database access.
 */

import config from '../../config.js';
import { serializeUser, serializeSession, serializeSecurityEvent } from '../../lib/serializers.js';
import { success, created, noContent, paginated } from '../../lib/response.js';
import { issueAccessToken } from '../../lib/jwt.js';

function setSessionCookie(res, token) {
  res.cookie(config.session.cookieName, token, {
    httpOnly: true,
    secure: config.session.cookieSecure,
    sameSite: config.session.cookieSameSite,
    domain: config.session.cookieDomain,
    maxAge: config.session.ttlMs,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(config.session.cookieName, {
    httpOnly: true,
    secure: config.session.cookieSecure,
    sameSite: config.session.cookieSameSite,
    domain: config.session.cookieDomain,
    path: '/',
  });
}

function clientContext(req) {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

export function createIdentityController({ service }) {
  return {
    /* =========================================================================
     * AUTH
     * ====================================================================== */

    async register(req, res) {
      const { ip, userAgent } = clientContext(req);
      const result = await service.register(
        {
          email: req.body.email,
          password: req.body.password,
          username: req.body.username,
          displayName: req.body.displayName,
          preferredLanguage: req.body.preferredLanguage,
          timezone: req.body.timezone,
          referralCode: req.body.referralCode,
          termsVersion: req.body.termsVersion || 'v1',
          privacyVersion: req.body.privacyVersion || 'v1',
          ip,
          userAgent,
        },
        { requestId: req.id }
      );

      return created(res, {
        user: serializeUser(result.user),
        next: 'verify_email',
        verificationEmail: {
          status: result.verificationEmail.status,
          ...(result.verificationEmail.expiresInHours
            ? { expiresInHours: result.verificationEmail.expiresInHours }
            : {}),
        },
      });
    },

    async login(req, res) {
      const { ip, userAgent } = clientContext(req);

      const result = await service.login({
        email: req.body.email,
        password: req.body.password,
        rememberMe: req.body.rememberMe,
        deviceLabel: req.body.deviceLabel,
        ip,
        userAgent,
      });

      if (result.mfaRequired) {
        return success(res, {
          mfaRequired: true,
          challengeToken: result.challengeToken,
        });
      }

      setSessionCookie(res, result.sessionToken);

      return success(res, {
        mfaRequired: false,
        user: serializeUser(result.user),
        session: serializeSession(result.session, result.session.id),
        accessToken: result.accessToken,
      });
    },

    async verifyMfa(req, res) {
      const { ip, userAgent } = clientContext(req);

      const result = await service.verifyMfaChallenge({
        challengeToken: req.body.challengeToken,
        code: req.body.code,
        method: req.body.method,
        ip,
        userAgent,
      });

      setSessionCookie(res, result.sessionToken);

      return success(res, {
        user: serializeUser(result.user),
        session: serializeSession(result.session, result.session.id),
        accessToken: result.accessToken,
      });
    },

    async refreshAccessToken(req, res) {
      const accessToken = issueAccessToken({
        userId: req.auth.userId,
        sessionId: req.auth.sessionId,
      });
      return success(res, { accessToken });
    },

    async logout(req, res) {
      if (req.auth?.sessionId) {
        await service.revokeSession({
          userId: req.auth.userId,
          sessionId: req.auth.sessionId,
        });
      }
      clearSessionCookie(res);
      return noContent(res);
    },

    async logoutAll(req, res) {
      const result = await service.revokeAllSessions(req.auth.userId, {
        reason: 'user_logout_all',
      });
      clearSessionCookie(res);
      return success(res, result);
    },

    /* =========================================================================
     * EMAIL VERIFICATION
     * ====================================================================== */

    async verifyEmail(req, res) {
      const result = await service.verifyEmail({ token: req.body.token });
      return success(res, {
        status: result.status,
        user: serializeUser(result.user),
      });
    },

    async resendVerification(req, res) {
      const { ip } = clientContext(req);
      const result = await service.resendVerificationEmail({
        userId: req.auth?.userId,
        email: req.body.email,
        ip,
      });
      return success(res, result);
    },

    async getEmailVerificationStatus(req, res) {
      return success(res, await service.getEmailVerificationStatus({ userId: req.auth.userId }));
    },

    async beginPasskeyRegistration(req, res) {
      const { ip, userAgent } = clientContext(req);
      return success(
        res,
        await service.beginPasskeyRegistration({
          userId: req.auth.userId,
          ip,
          userAgent,
        })
      );
    },

    async finishPasskeyRegistration(req, res) {
      const { ip, userAgent } = clientContext(req);
      const passkey = await service.finishPasskeyRegistration({
        userId: req.auth.userId,
        response: req.body.response,
        name: req.body.name,
        ip,
        userAgent,
      });
      return created(res, {
        id: passkey.id,
        name: passkey.name,
        deviceType: passkey.device_type,
        backedUp: passkey.backed_up,
        createdAt: passkey.created_at,
      });
    },

    async beginPasskeyAuthentication(req, res) {
      const { ip, userAgent } = clientContext(req);
      return success(
        res,
        await service.beginPasskeyAuthentication({ ip, userAgent })
      );
    },

    async finishPasskeyAuthentication(req, res) {
      const { ip, userAgent } = clientContext(req);
      const result = await service.finishPasskeyAuthentication({
        response: req.body.response,
        ip,
        userAgent,
      });
      if (result.mfaRequired) {
        return success(res, {
          mfaRequired: true,
          challengeToken: result.challengeToken,
        });
      }
      setSessionCookie(res, result.sessionToken);
      return success(res, {
        user: serializeUser(result.user),
        session: serializeSession(result.session, result.session.id),
        accessToken: result.accessToken,
      });
    },

    async listPasskeys(req, res) {
      const rows = await service.listPasskeys({ userId: req.auth.userId });
      return success(res, rows.map((row) => ({
        id: row.id,
        name: row.name,
        deviceType: row.device_type,
        backedUp: row.backed_up,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
      })));
    },

    async renamePasskey(req, res) {
      const passkey = await service.renamePasskey({
        userId: req.auth.userId,
        passkeyId: req.params.passkeyId,
        name: req.body.name,
      });
      return success(res, {
        id: passkey.id,
        name: passkey.name,
        deviceType: passkey.device_type,
        backedUp: passkey.backed_up,
        createdAt: passkey.created_at,
        lastUsedAt: passkey.last_used_at,
      });
    },

    async removePasskey(req, res) {
      return success(res, await service.removePasskey({
        userId: req.auth.userId,
        passkeyId: req.params.passkeyId,
        ip: req.ip,
      }));
    },

    /* =========================================================================
     * PASSWORD
     * ====================================================================== */

    async changePassword(req, res) {
      const result = await service.changePassword({
        userId: req.auth.userId,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
        sessionId: req.auth.sessionId,
      });
      return success(res, result);
    },

    async requestPasswordReset(req, res) {
      const result = await service.requestPasswordReset({ email: req.body.email });
      return success(res, result);
    },

    async resetPassword(req, res) {
      const result = await service.resetPassword({
        token: req.body.token,
        newPassword: req.body.newPassword,
      });
      return success(res, result);
    },

    /* =========================================================================
     * MFA
     * ====================================================================== */

    async mfaBeginEnrollment(req, res) {
      const result = await service.beginMfaEnrollment({ userId: req.auth.userId });
      return success(res, result);
    },

    async mfaConfirmEnrollment(req, res) {
      const result = await service.confirmMfaEnrollment({
        userId: req.auth.userId,
        code: req.body.code,
      });
      return success(res, result);
    },

    async mfaDisable(req, res) {
      const result = await service.disableMfa({ userId: req.auth.userId });
      return success(res, result);
    },

    async mfaRegenerateRecoveryCodes(req, res) {
      const result = await service.regenerateRecoveryCodes({ userId: req.auth.userId });
      return success(res, result);
    },

    /* =========================================================================
     * SESSIONS
     * ====================================================================== */

    async listSessions(req, res) {
      const sessions = await service.listSessions({
        userId: req.auth.userId,
        currentSessionId: req.auth.sessionId,
      });
      return success(res, sessions.map((s) => serializeSession(s, req.auth.sessionId)));
    },

    async revokeSession(req, res) {
      const result = await service.revokeSession({
        userId: req.auth.userId,
        sessionId: req.params.sessionId,
      });
      return success(res, result);
    },

    /* =========================================================================
     * PROFILE
     * ====================================================================== */

    async getMe(req, res) {
      const user = await service.getUserById(req.auth.userId);
      const security = await service.getSecuritySettings?.(req.auth.userId);
      return success(res, {
        ...serializeUser(user),
        mfaEnabled: Boolean(security?.mfa_enabled_at),
      });
    },

    async updateProfile(req, res) {
      const user = await service.updateProfile({
        userId: req.auth.userId,
        updates: req.body,
      });
      return success(res, serializeUser(user));
    },

    async uploadAvatar(req, res) {
      const user = await service.updateAvatar({
        userId: req.auth.userId,
        file: req.file
          ? { buffer: req.file.buffer, mimeType: req.file.mimetype }
          : null,
      });
      return success(res, serializeUser(user));
    },

    async removeAvatar(req, res) {
      const user = await service.removeAvatar({ userId: req.auth.userId });
      return success(res, serializeUser(user));
    },

    async getProfileImage(req, res) {
      const image = await service.getProfileImage(req.params.key);
      if (!image) return res.status(404).end();
      res.setHeader('Content-Type', image.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(image.buffer);
    },

    async getUserPreferences(req, res) {
      return success(res, await service.getUserPreferences(req.auth.userId));
    },

    async updateUserPreferences(req, res) {
      const preferences = await service.updateUserPreferences({
        userId: req.auth.userId,
        updates: req.body,
      });
      return success(res, preferences);
    },

    async requestEmailChange(req, res) {
      const result = await service.requestEmailChange({
        userId: req.auth.userId,
        newEmail: req.body.newEmail,
        password: req.body.password,
      });
      return success(res, result);
    },

    async confirmEmailChange(req, res) {
      const user = await service.confirmEmailChange({ token: req.body.token });
      return success(res, serializeUser(user));
    },

    /* =========================================================================
     * TRUSTED DEVICES
     * ====================================================================== */

    async listTrustedDevices(req, res) {
      const devices = await service.listTrustedDevices({ userId: req.auth.userId });
      return success(res, devices.map((d) => ({
        id: d.id,
        deviceLabel: d.device_label,
        createdAt: d.created_at,
        lastSeenAt: d.last_seen_at,
        expiresAt: d.expires_at,
      })));
    },

    async revokeTrustedDevice(req, res) {
      const result = await service.revokeTrustedDevice({
        userId: req.auth.userId,
        deviceId: req.params.deviceId,
      });
      return success(res, result);
    },

    /* =========================================================================
     * SECURITY EVENTS
     * ====================================================================== */

    async listSecurityEvents(req, res) {
      const { rows, nextCursor } = await service.listSecurityEvents({
        userId: req.auth.userId,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeSecurityEvent), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },
  };
}

export default createIdentityController;