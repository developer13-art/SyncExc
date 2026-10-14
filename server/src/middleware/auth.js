/**
 * SyncExc Server — Authentication middleware
 *
 * Three layers:
 *
 *   requireAuth            → 401 if not authenticated
 *   optionalAuth           → attaches auth context if present, never rejects
 *   requireStepUp          → 403 if the session hasn't completed step-up
 *
 * Authentication accepts two credential shapes:
 *
 *   1. Session cookie (`syncexc_session`) → opaque token; hash stored in DB.
 *   2. `Authorization: Bearer <jwt>`     → access token.
 *
 * The session cookie is the canonical mechanism for browsers. The bearer
 * token exists for API clients and is issued alongside the cookie.
 */

import config from '../config.js';
import { AuthenticationError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { hashSessionToken } from '../modules/identity/session.service.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger({ component: 'auth' });

/**
 * Look up a session by its cookie token or bearer token.
 * Returns a normalized context or null.
 */
async function resolveSession(req) {
  const { session: sessionService } = req.services;

  // 1. Try the session cookie
  const cookieToken = req.cookies?.[config.session.cookieName];
  if (cookieToken) {
    const tokenHash = hashSessionToken(cookieToken);
    const session = await sessionService.findActiveByTokenHash(tokenHash);
    if (session) {
      return {
        userId: session.user_id,
        sessionId: session.id,
        isStepUp: session.step_up_at
          ? Date.now() - new Date(session.step_up_at).getTime() < 15 * 60 * 1000
          : false,
        stepUpAt: session.step_up_at,
      };
    }
    return null;
  }

  // 2. Try a bearer token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const payload = verifyAccessToken(token);
      return {
        userId: payload.sub,
        sessionId: payload.sid || null,
        isStepUp: Boolean(payload.step_up),
        stepUpAt: payload.step_up_at || null,
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Attach auth context if a valid session exists; never reject.
 */
export function optionalAuth() {
  return async function optionalAuthMiddleware(req, _res, next) {
    try {
      const session = await resolveSession(req);
      if (session) {
        req.auth = {
          userId: session.userId,
          sessionId: session.sessionId,
          isAuthenticated: true,
          isStepUp: session.isStepUp,
          stepUpAt: session.stepUpAt,
        };
      }
    } catch (err) {
      logger.warn({ err, requestId: req.id }, 'Optional auth lookup failed');
    }
    next();
  };
}

/**
 * Reject if no valid session exists.
 */
export function requireAuth() {
  return async function requireAuthMiddleware(req, _res, next) {
    try {
      const session = await resolveSession(req);
      if (!session) {
        throw new AuthenticationError();
      }

      // Load the user record so downstream middleware can check status.
      const { identity } = req.services;
      const user = await identity.getUserById(session.userId);

      if (!user) {
        throw new AuthenticationError('Account not found', 'ACCOUNT_NOT_FOUND');
      }
      if (user.status === 'suspended' || user.status === 'deleted') {
        throw new AuthenticationError('Account is not active', 'ACCOUNT_NOT_ACTIVE');
      }

      req.auth = {
        userId: session.userId,
        sessionId: session.sessionId,
        isAuthenticated: true,
        isStepUp: session.isStepUp,
        stepUpAt: session.stepUpAt,
        user,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Reject if the user has not recently completed step-up authentication.
 * Used for sensitive actions: role changes, refunds, feature flags.
 */
export function requireStepUp() {
  return async function requireStepUpMiddleware(req, _res, next) {
    if (!req.auth?.isAuthenticated) {
      return next(new AuthenticationError());
    }

    const { session } = req.services;
    const fresh = await session.isStepUpFresh(req.auth.sessionId, {
      maxAgeMs: 15 * 60 * 1000,
    });

    if (!fresh) {
      return next(
        new AuthenticationError(
          'This action requires recent verification. Please re-authenticate.',
          'STEP_UP_REQUIRED'
        )
      );
    }

    req.auth.isStepUp = true;
    next();
  };
}

/**
 * Attach the user record only if authenticated. Used by routes that want the
 * full user object but do not require authentication (e.g. personalized
 * responses to anonymous visitors).
 */
export function loadUserIfAuthenticated() {
  return async function loadUserIfAuthenticatedMiddleware(req, _res, next) {
    if (!req.auth?.isAuthenticated || req.auth.user) return next();
    try {
      const { identity } = req.services;
      const user = await identity.getUserById(req.auth.userId);
      if (user) req.auth.user = user;
    } catch (err) {
      logger.warn({ err, requestId: req.id }, 'Failed to load user for authenticated request');
    }
    next();
  };
}

export default {
  optionalAuth,
  requireAuth,
  requireStepUp,
  loadUserIfAuthenticated,
};