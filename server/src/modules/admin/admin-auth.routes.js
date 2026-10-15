import { Router } from 'express';
import Joi from 'joi';

import config from '../../config.js';
import { AuthenticationError, AuthorizationError } from '../../lib/errors.js';
import { success, noContent } from '../../lib/response.js';
import { serializeUser, serializeSession } from '../../lib/serializers.js';
import { hashSessionToken } from '../identity/identity.service.js';

const LoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().optional(),
  deviceLabel: Joi.string().max(200).optional(),
});

const MfaVerifySchema = Joi.object({
  challengeToken: Joi.string().min(32).max(256).required(),
  code: Joi.string().min(6).max(32).required(),
  method: Joi.string().valid('totp', 'recovery').default('totp'),
});

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

export function createAdminAuthRoutes({ identity, permission, middleware }) {
  const router = Router();

  async function getAdmin(user) {
    const access = await permission.getEffectivePermissions(user.id);
    if (access.roles.length === 0) {
      throw new AuthorizationError('Administrator access required', 'ADMIN_REQUIRED');
    }
    return {
      ...serializeUser(user),
      roles: access.roles,
      permissions: Array.from(access.permissions),
    };
  }

  async function revokeSession(result) {
    if (result?.user?.id && result?.session?.id) {
      await identity.service.revokeSession({
        userId: result.user.id,
        sessionId: result.session.id,
      });
    }
  }

  router.post(
    '/login',
    middleware.authLimiter,
    middleware.validateBody(LoginSchema),
    middleware.asyncHandler(async (req, res) => {
      const result = await identity.service.login({
        ...req.body,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      if (result.mfaRequired) {
        try {
          await getAdmin({ id: result.userId });
        } catch (err) {
          if (err instanceof AuthorizationError) {
            throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');
          }
          throw err;
        }
        return success(res, {
          mfaRequired: true,
          challengeToken: result.challengeToken,
        });
      }

      let admin;
      try {
        admin = await getAdmin(result.user);
      } catch (err) {
        await revokeSession(result);
        if (err instanceof AuthorizationError) {
          throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');
        }
        throw err;
      }

      setSessionCookie(res, result.sessionToken);
      return success(res, {
        admin,
        session: serializeSession(result.session, result.session.id),
        accessToken: result.accessToken,
      });
    })
  );

  router.post(
    '/mfa/verify',
    middleware.authLimiter,
    middleware.validateBody(MfaVerifySchema),
    middleware.asyncHandler(async (req, res) => {
      const result = await identity.service.verifyMfaChallenge({
        challengeId: hashSessionToken(req.body.challengeToken),
        code: req.body.code,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      let admin;
      try {
        admin = await getAdmin(result.user);
      } catch (err) {
        await revokeSession(result);
        if (err instanceof AuthorizationError) {
          throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');
        }
        throw err;
      }

      setSessionCookie(res, result.sessionToken);
      return success(res, {
        admin,
        session: serializeSession(result.session, result.session.id),
        accessToken: result.accessToken,
      });
    })
  );

  router.post(
    '/logout',
    middleware.requireAuth(),
    middleware.asyncHandler(async (req, res) => {
      if (req.auth.sessionId) {
        await identity.service.revokeSession({
          userId: req.auth.userId,
          sessionId: req.auth.sessionId,
        });
      }
      clearSessionCookie(res);
      return noContent(res);
    })
  );

  router.use(middleware.requireAuth(), middleware.requireAdmin());

  router.get(
    '/me',
    middleware.asyncHandler(async (req, res) => {
      const admin = await getAdmin(req.auth.user);
      return success(res, admin);
    })
  );

  return router;
}
