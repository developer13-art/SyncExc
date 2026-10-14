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
      const user = await service.register(
        {
          email: req.body.email,
          password: req.body.password,
          username: req.body.username,
          displayName: req.body.displayName,
          preferredLanguage: req.body.preferredLanguage,
          timezone: req.body.timezone,
          termsVersion: req.body.termsVersion || 'v1',
          privacyVersion: req.body.privacyVersion || 'v1',
          ip,
          userAgent,
        },
        { requestId: req.id }
      );

      return created(res, {
        user: serializeUser(user),
        next: 'verify_email',
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
        challengeId: req.body.challengeId,
        code: req.body.code,
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
      const user = await service.verifyEmail({ token: req.body.token });
      return success(res, { user: serializeUser(user) });
    },

    async resendVerification(req, res) {
      const result = await service.resendVerificationEmail({ email: req.body.email });
      return success(res, result);
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