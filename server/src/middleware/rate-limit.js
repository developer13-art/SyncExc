/**
 * SyncExc Server — Rate limiting middleware
 *
 * Token-based in-memory rate limiting. Multiple limiters can be
 * applied to the same request with different keys.
 *
 * Keys are built from:
 *   - authenticated user ID when available
 *   - else IP address
 *   - plus a scope string so auth, AI, and exchange endpoints don't share
 *     the same bucket.
 *
 * Limiters:
 *   - global: every request
 *   - auth: login/register/password routes
 *   - ai: AI-backed endpoints
 *   - exchange: endpoints that hit exchange APIs
 *   - write: mutation endpoints
 *
 * Overrides can be set per-route via `rateLimit(...)`.
 */

import config from '../config.js';
import { RateLimitError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger({ component: 'rate-limit' });

/* =============================================================================
 * CLIENT KEY
 * ========================================================================== */

function clientKey(req, scope) {
  const userPart = req.auth?.userId ? `u:${req.auth.userId}` : `i:${req.ip}`;
  return `rl:${scope}:${userPart}`;
}

/* =============================================================================
 * CORE LIMITER
 * ========================================================================== */

/**
 * Build a rate limiter for a given scope.
 *
 * @param {Object} opts
 * @param {string} opts.scope         Unique namespace.
 * @param {number} opts.max           Max requests per window.
 * @param {number} [opts.windowMs]    Window duration; defaults to global window.
 * @param {(req) => string} [opts.keyFn]  Optional custom key function.
 */
export function createLimiter({ scope, max, windowMs, keyFn }) {
  const effectiveWindow = windowMs ?? config.rateLimit.windowMs;

  return async function rateLimitMiddleware(req, res, next) {
    try {
      const { rateLimiter } = req.services;
      const key = keyFn ? keyFn(req) : clientKey(req, scope);
      const windowSeconds = Math.ceil(effectiveWindow / 1000);

      const current = rateLimiter.incrementWithTtl(key, windowSeconds);
      const remaining = Math.max(0, max - current);
      const resetAt = Date.now() + effectiveWindow;

      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

      if (current > max) {
        const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
        res.setHeader('Retry-After', String(retryAfter));
        logger.debug(
          { scope, key, current, max, requestId: req.id },
          'Rate limit exceeded'
        );
        throw new RateLimitError('Too many requests', retryAfter);
      }

      next();
    } catch (err) {
      if (err instanceof RateLimitError) return next(err);
      // Never fail-open on limiter errors in production
      if (config.isProduction) {
        logger.error({ err, requestId: req.id }, 'Rate limiter failure');
        return next(err);
      }
      logger.warn({ err, requestId: req.id }, 'Rate limiter failure in dev; allowing');
      next();
    }
  };
}

/* =============================================================================
 * NAMED LIMITERS
 * ========================================================================== */

export const globalLimiter = createLimiter({
  scope: 'global',
  max: config.rateLimit.maxRequests,
});

export const authLimiter = createLimiter({
  scope: 'auth',
  max: config.rateLimit.authMax,
});

export const aiLimiter = createLimiter({
  scope: 'ai',
  max: config.rateLimit.aiMax,
});

export const exchangeLimiter = createLimiter({
  scope: 'exchange',
  max: config.rateLimit.exchangeMax,
});

export const writeLimiter = createLimiter({
  scope: 'write',
  max: Math.floor(config.rateLimit.maxRequests / 2),
});

/* =============================================================================
 * APPLY
 * ========================================================================== */

export function applyRateLimitMiddleware(app) {
  // Global limiter runs on all requests. Per-route limiters are added in the
  // router definitions where they apply.
  app.use(globalLimiter);
}

export default {
  createLimiter,
  globalLimiter,
  authLimiter,
  aiLimiter,
  exchangeLimiter,
  writeLimiter,
  applyRateLimitMiddleware,
};