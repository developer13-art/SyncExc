/**
 * SyncExc Server — Idempotency middleware
 *
 * For routes that must be safe to replay, require an `Idempotency-Key`
 * header. The middleware:
 *
 *   1. Validates the key format.
 *   2. Claims the key in the DB with the request body hash.
 *   3. Executes the route handler under the claim.
 *   4. Persists the response and marks the key completed.
 *
 * If the route errors, the key is marked failed and can be retried.
 *
 * Usage:
 *   router.post('/orders', requireIdempotency('orders.submit'), handler)
 */

import { ConflictError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger({ component: 'idempotency' });

export function requireIdempotency(scope) {
  return async function requireIdempotencyMiddleware(req, res, next) {
    try {
      const key = req.headers['x-idempotency-key'];
      if (!key || typeof key !== 'string') {
        throw new ConflictError(
          'Missing required Idempotency-Key header',
          'IDEMPOTENCY_KEY_REQUIRED'
        );
      }
      if (key.length < 8 || key.length > 256) {
        throw new ConflictError(
          'Idempotency-Key must be between 8 and 256 characters',
          'IDEMPOTENCY_KEY_INVALID'
        );
      }

      req.idempotency = { key, scope };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Optional idempotency: uses the key if provided, otherwise proceeds.
 * Useful for endpoints where replay protection is beneficial but not
 * mandatory.
 */
export function optionalIdempotency(scope) {
  return function optionalIdempotencyMiddleware(req, _res, next) {
    const key = req.headers['x-idempotency-key'];
    if (key && typeof key === 'string' && key.length >= 8 && key.length <= 256) {
      req.idempotency = { key, scope };
    }
    next();
  };
}

/**
 * Response helper that runs an operation under idempotency if a key is
 * present, otherwise runs it directly.
 *
 *   const result = await runIdempotent(req, async () => {
 *     const order = await orderService.submit(...);
 *     return { status: 201, body: serializeOrder(order) };
 *   });
 *   res.status(result.status).json({ data: result.body });
 */
export async function runIdempotent(req, execute) {
  if (!req.idempotency) {
    return execute();
  }
  const { idempotency } = req.services;
  const { key, scope } = req.idempotency;

  logger.debug({ key, scope, requestId: req.id }, 'Executing under idempotency');

  const result = await idempotency.run({
    key,
    scope,
    actorId: req.auth?.userId || null,
    workspaceId: req.workspace?.id || null,
    requestBody: {
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      body: req.body,
    },
    execute,
  });

  if (result.replayed) {
    logger.info({ key, scope }, 'Idempotent replay served');
  }

  return result;
}

export default {
  requireIdempotency,
  optionalIdempotency,
  runIdempotent,
};