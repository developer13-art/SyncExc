const DEFAULT_MAX_KEYS = 100_000;
const CLEANUP_INTERVAL = 256;

export function createInMemoryRateLimiter({ maxKeys = DEFAULT_MAX_KEYS } = {}) {
  const counters = new Map();
  let operations = 0;

  function removeExpired(now) {
    for (const [key, counter] of counters) {
      if (counter.expiresAt <= now) counters.delete(key);
    }
  }

  return {
    incrementWithTtl(key, ttlSeconds, amount = 1) {
      const now = Date.now();
      operations += 1;

      if (operations % CLEANUP_INTERVAL === 0 || counters.size >= maxKeys) {
        removeExpired(now);
      }

      let counter = counters.get(key);
      if (!counter || counter.expiresAt <= now) {
        if (!counter && counters.size >= maxKeys) {
          throw new Error('In-memory rate limiter capacity exceeded');
        }
        counter = { count: 0, expiresAt: now + ttlSeconds * 1000 };
        counters.set(key, counter);
      }

      counter.count += amount;
      return counter.count;
    },
  };
}

export default createInMemoryRateLimiter;
