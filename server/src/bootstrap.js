/**
 * SyncExc Server — Bootstrap
 *
 * Every subsystem is initialized here, in dependency order, and returned as
 * a single `services` object. Anything that needs the DB, Redis, event bus,
 * or job runner receives them from this object — nothing imports infrastructure
 * singletons directly.
 */

import config from './config.js';
import { createLogger } from './lib/logger.js';
import { initDatabase } from './database/index.js';
import { initRedis } from './lib/redis.js';
import { initEvents } from './events/index.js';
import { initJobs } from './jobs/index.js';
import { initRealtime } from './realtime/index.js';
import { initMetrics } from './lib/metrics.js';
import { initStorage } from './lib/storage.js';
import { initMailer } from './lib/mailer.js';
import { initPush } from './lib/push.js';
import { initAI } from './lib/ai.js';
import { initExchangeAdapters } from './modules/connections/adapters/index.js';
import { initExchangeStreams } from './modules/connections/streams.js';
import { initSourceListeners } from './modules/sources/listeners.js';

export async function bootstrap() {
  const logger = createLogger({ component: 'bootstrap' });

  // ---------------------------------------------------------------------------
  // Infrastructure
  // ---------------------------------------------------------------------------
  logger.info('Initializing database pool');
  const db = await initDatabase();

  logger.info('Initializing Redis');
  const redis = await initRedis();

  logger.info('Initializing metrics');
  const metrics = initMetrics();

  // ---------------------------------------------------------------------------
  // Cross-cutting services
  // ---------------------------------------------------------------------------
  logger.info('Initializing storage');
  const storage = await initStorage();

  logger.info('Initializing mailer');
  const mailer = await initMailer();

  logger.info('Initializing push notifications');
  const push = await initPush();

  logger.info('Initializing AI clients');
  const ai = await initAI();

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  logger.info('Initializing event bus and outbox');
  const events = await initEvents({ db, redis, logger });

  // ---------------------------------------------------------------------------
  // Realtime gateway
  // ---------------------------------------------------------------------------
  logger.info('Initializing realtime gateway');
  const realtime = initRealtime({ redis, logger, events });

  // ---------------------------------------------------------------------------
  // Exchange adapters and streams
  // ---------------------------------------------------------------------------
  logger.info('Initializing exchange adapters');
  const exchange = await initExchangeAdapters({ logger, db });

  logger.info('Initializing exchange streams');
  const exchangeStreams = await initExchangeStreams({
    db,
    exchange,
    events,
    realtime,
    logger,
  });

  // ---------------------------------------------------------------------------
  // Source listeners
  // ---------------------------------------------------------------------------
  logger.info('Initializing source listeners');
  const sourceListeners = await initSourceListeners({
    db,
    events,
    realtime,
    logger,
  });

  // ---------------------------------------------------------------------------
  // Services bundle (passed to app + jobs)
  // ---------------------------------------------------------------------------
  const services = {
    config,
    logger,
    db,
    redis,
    metrics,
    storage,
    mailer,
    push,
    ai,
    events,
    realtime,
    exchange,
    exchangeStreams,
    sourceListeners,
  };

  // ---------------------------------------------------------------------------
  // Jobs — initialized last since handlers use every service above
  // ---------------------------------------------------------------------------
  logger.info('Initializing job runner and scheduler');
  const jobs = await initJobs({ services });
  services.jobs = jobs;

  logger.info('All subsystems initialized');

  return services;
}