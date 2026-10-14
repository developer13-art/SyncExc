/**
 * SyncExc Server — Rate-limit coordinator
 *
 * Each exchange has per-endpoint weight limits. This service:
 *   - tracks weights per exchange
 *   - refuses requests that would exceed limits
 *   - returns a "wait until" timestamp when a request is throttled
 *
 * Backed by Redis for cross-process coordination.
 */

import { createLogger } from '../../lib/logger.js';

export function createRateLimitCoordinator({ db, redis, logger }) {
  const log = logger || createLogger({ component: 'connections:ratelimit' });

  // Weight definitions per exchange. Approximation of each exchange's
  // documented request weight model.
  const WEIGHTS = {
    binance: { perMinute: 1200, endpointWeights: {} },
    bybit: { perMinute: 600, endpointWeights: {} },
    bitget: { perMinute: 600, endpointWeights: {} },
    okx: { perMinute: 500, endpointWeights: {} },
  };

  return {
    /**
     * Consume one unit of weight for the exchange. Throws if the limit
     * would be exceeded.
     */
    async consume({ exchangeCode, weight = 1 }) {
      const config = WEIGHTS[exchangeCode];
      if (!config) return { ok: true };

      const windowKey = `ratelimit:${exchangeCode}:${Math.floor(Date.now() / 60000)}`;
      const current = await redis.incrementWithTtl(windowKey, 120);

      if (current > config.perMinute) {
        log.warn({ exchangeCode, current, limit: config.perMinute }, 'Rate limit exceeded');
        throw new Error(`Rate limit exceeded for ${exchangeCode}`);
      }

      return { ok: true, current, limit: config.perMinute };
    },

    /**
     * Wait until the rate limit window resets, then return. Used by the
     * dispatcher when the exchange returns a rate-limit error.
     */
    async waitForWindow(exchangeCode) {
      const delayMs = 60000 - (Date.now() % 60000) + 1000;
      log.info({ exchangeCode, delayMs }, 'Waiting for rate-limit window reset');
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    },
  };
}

export default createRateLimitCoordinator;