/**
 * SyncExc Server — Email module
 *
 * Owns transactional email delivery visibility:
 *   - email_deliveries lifecycle records (written by the recorder wrapper)
 *   - Resend webhook ingestion (signature-verified, deduplicated)
 *
 * The send path itself lives in lib/mailer.js + the recorder wrapper, which
 * bootstrap installs before domain modules are created.
 */

import { createEmailQueries } from './email.queries.js';
import { createEmailService } from './email.service.js';
import { createEmailRoutes } from './email.routes.js';
import { createLogger } from '../../lib/logger.js';

export function createEmailModule({ services }) {
  const logger = createLogger({ component: 'email' });

  const queries = createEmailQueries({ db: services.db });
  const service = createEmailService({ db: services.db, queries, logger });
  const routes = createEmailRoutes({ service, middleware: services.middleware });

  return {
    name: 'email',
    queries,
    service,
    routes,
    publicApi: {},

    async shutdown() {
      logger.debug('Email module shutdown');
    },
  };
}

export default createEmailModule;
