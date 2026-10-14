/**
 * SyncExc Server — Middleware index
 *
 * Exports the individual appliers plus the commonly used per-route
 * middleware functions so modules can import from a single path.
 */

export { applySecurityMiddleware } from './security.js';
export { applyRequestMiddleware } from './request.js';
export { applyContextMiddleware } from './context.js';
export {
  optionalAuth,
  requireAuth,
  requireStepUp,
  loadUserIfAuthenticated,
} from './auth.js';
export {
  requireWorkspace,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  requireEntitlement,
  requireFeatureFlag,
  requireSelf,
} from './permission.js';
export {
  validate,
  validateBody,
  validateQuery,
  validateParams,
} from './validation.js';
export {
  createLimiter,
  globalLimiter,
  authLimiter,
  aiLimiter,
  exchangeLimiter,
  writeLimiter,
  applyRateLimitMiddleware,
} from './rate-limit.js';
export {
  requireIdempotency,
  optionalIdempotency,
  runIdempotent,
} from './idempotency.js';
export {
  verifySyncExcSignature,
  verifyStripeSignature,
  verifyPaystackSignature,
  verifyFlutterwaveSignature,
  verifyBearerToken,
} from './webhook.js';
export { applyErrorMiddleware } from './error.js';

import { optionalAuth, requireAuth, requireStepUp, loadUserIfAuthenticated } from './auth.js';
import {
  requireWorkspace,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  requireEntitlement,
  requireFeatureFlag,
  requireSelf,
} from './permission.js';
import { validate, validateBody, validateQuery, validateParams } from './validation.js';
import {
  createLimiter,
  globalLimiter,
  authLimiter,
  aiLimiter,
  exchangeLimiter,
  writeLimiter,
} from './rate-limit.js';
import { requireIdempotency, optionalIdempotency, runIdempotent } from './idempotency.js';
import {
  verifySyncExcSignature,
  verifyStripeSignature,
  verifyPaystackSignature,
  verifyFlutterwaveSignature,
  verifyBearerToken,
} from './webhook.js';

/**
 * Default export: aggregated middleware object for ergonomic imports.
 *
 *   import mw from '../middleware/index.js';
 *   router.post('/orders', mw.requireAuth(), mw.requireWorkspace(), handler);
 */
const middleware = {
  // Auth
  optionalAuth,
  requireAuth,
  requireStepUp,
  loadUserIfAuthenticated,

  // Authorization
  requireWorkspace,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  requireEntitlement,
  requireFeatureFlag,
  requireSelf,

  // Validation
  validate,
  validateBody,
  validateQuery,
  validateParams,

  // Rate limiting
  createLimiter,
  globalLimiter,
  authLimiter,
  aiLimiter,
  exchangeLimiter,
  writeLimiter,

  // Idempotency
  requireIdempotency,
  optionalIdempotency,
  runIdempotent,

  // Webhook verification
  verifySyncExcSignature,
  verifyStripeSignature,
  verifyPaystackSignature,
  verifyFlutterwaveSignature,
  verifyBearerToken,
};

export default middleware;