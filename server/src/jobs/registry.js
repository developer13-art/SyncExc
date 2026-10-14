/**
 * SyncExc Server — Job handler registry
 *
 * Maps a job type (string) to a handler function. The runner looks up the
 * handler by type and calls it with `{ payload, jobId, attempt, services }`.
 *
 * Handlers must:
 *   - Be idempotent.
 *   - Throw on retryable failure; return normally on success.
 *   - Never use process.exit.
 *   - Not exceed a reasonable runtime (the runner enforces a wall-clock
 *     timeout per attempt).
 */

import { createLogger } from '../lib/logger.js';

export function createJobRegistry({ logger: injectedLogger }) {
  const logger = injectedLogger || createLogger({ component: 'jobs:registry' });
  const handlers = new Map();

  return {
    /**
     * Register a handler for a job type.
     *
     * @param {string} type
     * @param {(ctx: { payload: object, jobId: string, attempt: number, services: object }) => Promise<void>} handler
     */
    register(type, handler) {
      if (typeof type !== 'string' || type.length === 0) {
        throw new Error('Job type must be a non-empty string');
      }
      if (typeof handler !== 'function') {
        throw new Error(`Handler for job type '${type}' must be a function`);
      }
      if (handlers.has(type)) {
        throw new Error(`Handler for job type '${type}' is already registered`);
      }
      handlers.set(type, handler);
      logger.debug({ type }, 'Job handler registered');
    },

    /**
     * Look up a handler by type. Returns undefined if not registered.
     */
    get(type) {
      return handlers.get(type);
    },

    /**
     * Throw if no handler is registered for a type.
     */
    require(type) {
      const handler = handlers.get(type);
      if (!handler) {
        throw new Error(`No handler registered for job type '${type}'`);
      }
      return handler;
    },

    /**
     * List registered types (for diagnostics).
     */
    list() {
      return Array.from(handlers.keys());
    },

    /**
     * Check if a type is registered.
     */
    has(type) {
      return handlers.has(type);
    },
  };
}

export default createJobRegistry;