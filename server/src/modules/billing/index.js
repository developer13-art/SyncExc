/**
 * SyncExc Server — Billing module (Module 02)
 *
 * Owns:
 *   - plans and plan versions
 *   - subscriptions and lifecycle
 *   - checkout sessions
 *   - payments, invoices, refunds, disputes
 *   - entitlements and usage metering
 *   - provider webhooks (Stripe / Paystack / Flutterwave)
 *
 * Public API:
 *   billing.checkEntitlement({ scopeType, scopeId, featureKey })
 *   billing.getActiveSubscriptionForScope(scopeType, scopeId)
 *   billing.recordUsage({ scopeType, scopeId, dimension, amount })
 */

import { createBillingQueries } from './billing.queries.js';
import { createBillingService } from './billing.service.js';
import { createBillingRoutes } from './billing.routes.js';
import { createPaymentProviderFactory } from './providers/index.js';
import { createLogger } from '../../lib/logger.js';

export function createBillingModule({ services }) {
  const logger = createLogger({ component: 'billing' });

  const queries = createBillingQueries({ db: services.db });

  const providerFactory = createPaymentProviderFactory({
    logger,
    stripe: services.config?.payments?.stripe,
    paystack: services.config?.payments?.paystack,
    flutterwave: services.config?.payments?.flutterwave,
  });

  const service = createBillingService({
    db: services.db,
    queries,
    rateLimiter: services.rateLimiter,
    mailer: services.mailer,
    events: services.events,
    audit: services.audit,
    providerFactory,
    logger,
  });

  const routes = createBillingRoutes({ service, middleware: services.middleware });

  const publicApi = {
    checkEntitlement: (params) => service.checkEntitlement(params),
    getActiveSubscriptionForScope: (scopeType, scopeId) =>
      service.getActiveSubscriptionForScope(scopeType, scopeId),
    recordUsage: (params) => service.recordUsage(params),
  };

  return {
    name: 'billing',
    routes,
    service,
    queries,
    publicApi,
    providerFactory,

    async shutdown() {
      logger.debug('Billing module shutdown');
    },
  };
}

export default createBillingModule;