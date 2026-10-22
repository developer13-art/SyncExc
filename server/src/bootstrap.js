/**
 * Initializes the infrastructure and domain modules in dependency order.
 */

import config from './config.js';
import { createLogger } from './lib/logger.js';
import { initDatabase } from './database/index.js';
import { createInMemoryRateLimiter } from './lib/in-memory-rate-limiter.js';
import { initEvents } from './events/index.js';
import { initJobs } from './jobs/index.js';
import { initRealtime } from './realtime/index.js';
import { initMetrics } from './lib/metrics.js';
import { initStorage } from './lib/storage.js';
import {
  createDatabaseProfileImageStorage,
  createProfileImageService,
} from './lib/profile-images.js';
import { initMailer } from './lib/mailer.js';
import { initPush } from './lib/push.js';
import { initAI } from './lib/ai.js';
import { createAuditService } from './lib/audit.js';
import { createIdempotencyService } from './lib/idempotency.js';
import middleware from './middleware/index.js';
import { initializeModules } from './modules/index.js';

export async function bootstrap() {
  const logger = createLogger({ component: 'bootstrap' });
  const services = {
    config,
    logger,
    middleware,
    modules: {},
    rateLimiter: createInMemoryRateLimiter(),
  };

  logger.info('Initializing database pool');
  services.db = await initDatabase();

  try {
    services.metrics = initMetrics();
    services.storage = await initStorage();
    services.profileImages = createProfileImageService({
      storage: createDatabaseProfileImageStorage({ db: services.db }),
      baseUrl: config.server.baseUrl,
      apiPrefix: config.server.apiPrefix,
    });
    services.mailer = await initMailer();
    services.push = await initPush();
    services.ai = await initAI();
    services.audit = createAuditService({ db: services.db });
    services.idempotency = createIdempotencyService({ db: services.db });

    logger.info('Initializing event bus and outbox');
    services.events = await initEvents({ db: services.db, logger });
    services.realtime = initRealtime({
      db: services.db,
      logger,
      events: services.events,
    });

    const jobsFacade = {
      enqueue(...args) {
        if (!services.jobsRunner) {
          throw new Error('Job runner is not initialized yet');
        }
        return services.jobsRunner.enqueue(...args);
      },
      enqueueBulk(...args) {
        if (!services.jobsRunner) {
          throw new Error('Job runner is not initialized yet');
        }
        return services.jobsRunner.enqueueBulk(...args);
      },
    };
    services.jobs = jobsFacade;

    logger.info('Initializing domain modules');
    const modules = initializeModules(services);
    await Promise.all([
      modules.notifications.eventRegistry.persistDefaults(),
      modules.notifications.template.registerDefaults(),
    ]);

    logger.info('Initializing job runner and scheduler');
    services.jobsRunner = await initJobs({ services });
    Object.assign(jobsFacade, services.jobsRunner);

    logger.info('All subsystems initialized');
    return services;
  } catch (err) {
    await Promise.allSettled([
      services.realtime?.shutdown?.(),
      services.events?.shutdown?.(),
      services.db?.close?.(),
    ]);
    throw err;
  }
}

export default bootstrap;
