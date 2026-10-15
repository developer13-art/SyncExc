import Redis from 'ioredis';

import config from '../config.js';
import { createLogger } from './logger.js';

export async function initRedis() {
  const logger = createLogger({ component: 'redis' });
  const client = new Redis(config.redis.url, {
    password: config.redis.password,
    db: config.redis.db,
    keyPrefix: config.redis.keyPrefix,
    lazyConnect: true,
    connectTimeout: 10_000,
    maxRetriesPerRequest: 2,
    retryStrategy(attempt) {
      return attempt > 3 ? null : Math.min(attempt * 250, 1000);
    },
  });

  client.on('error', (err) => logger.error({ err }, 'Redis client error'));
  await client.connect();
  await client.ping();
  logger.info('Redis ready');

  return {
    incrementWithTtl: async (key, ttlSeconds) => {
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, ttlSeconds);
      }
      return count;
    },

    async health() {
      const startedAt = Date.now();
      const result = await client.ping();
      return { ok: result === 'PONG', latencyMs: Date.now() - startedAt };
    },

    async quit() {
      if (client.status === 'end') return;
      await client.quit();
    },
  };
}

export default initRedis;
