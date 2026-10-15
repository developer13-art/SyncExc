/**
 * SyncExc Server — Referral module (Module 13)
 *
 * Owns:
 *   - affiliate enrollment and profiles
 *   - referral links and click tracking
 *   - attribution (deterministic, versioned)
 *   - commission policies (versioned, immutable)
 *   - commission calculation on qualifying payments
 *   - append-only commission ledger
 *   - payout requests and provider adapters
 *   - fraud detection
 *
 * Public API:
 *   referral.attribution.attributeRegistration(params)
 *   referral.commission.processPaymentForCommissions(paymentId)
 *   referral.payout.processPayoutRequest(payoutId)
 */

import { createReferralQueries } from './referral.queries.js';
import { createAffiliateService } from './affiliate.service.js';
import { createLinkService } from './link.service.js';
import { createAttributionService } from './attribution.service.js';
import { createCommissionService } from './commission.service.js';
import { createCommissionPolicyService } from './commission-policy.service.js';
import { createLedgerService } from './ledger.service.js';
import { createPayoutService } from './payout.js';
import { createEligibilityService } from './eligibility.service.js';
import { createFraudService } from './fraud.js';
import { createDashboardService } from './dashboard.service.js';
import { createReferralRoutes } from './referral.routes.js';
import { createPayoutProviderRegistry } from './payout-providers/index.js';
import { createReferralListeners } from './listeners.js';
import { createLogger } from '../../lib/logger.js';

export function createReferralModule({ services }) {
  const logger = createLogger({ component: 'referral' });

  const queries = createReferralQueries({ db: services.db });

  const payoutProviderRegistry = createPayoutProviderRegistry({
    logger,
    config: services.config,
  });

  const commissionPolicyService = createCommissionPolicyService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const affiliateService = createAffiliateService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const linkService = createLinkService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const attributionService = createAttributionService({
    db: services.db,
    queries,
    linkService,
    affiliateService,
    events: services.events,
    logger,
  });

  const eligibilityService = createEligibilityService({
    db: services.db,
    queries,
    commissionPolicyService,
    logger,
  });

  const ledgerService = createLedgerService({
    db: services.db,
    queries,
    logger,
  });

  const commissionService = createCommissionService({
    db: services.db,
    queries,
    attributionService,
    eligibilityService,
    ledgerService,
    events: services.events,
    logger,
  });

  const fraudService = createFraudService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const payoutService = createPayoutService({
    db: services.db,
    queries,
    ledgerService,
    providerRegistry: payoutProviderRegistry,
    fraudService,
    events: services.events,
    logger,
  });

  const dashboardService = createDashboardService({
    db: services.db,
    queries,
    ledgerService,
    logger,
  });

  const routes = createReferralRoutes({
    affiliateService,
    linkService,
    commissionService,
    commissionPolicyService,
    payoutService,
    dashboardService,
    fraudService,
    middleware: services.middleware,
  });

  const listeners = createReferralListeners({
    events: services.events,
    commissionService,
    logger,
  });

  const publicApi = {
    attribution: {
      attributeRegistration: (params) => attributionService.attributeRegistration(params),
    },
    commission: {
      processPaymentForCommissions: (paymentId) =>
        commissionService.processPaymentForCommissions(paymentId),
    },
    payout: {
      processPayoutRequest: (payoutId) => payoutService.processPayoutRequest(payoutId),
    },
  };

  return {
    name: 'referral',
    routes,
    queries,
    affiliate: affiliateService,
    link: linkService,
    attribution: attributionService,
    commission: commissionService,
    commissionPolicy: commissionPolicyService,
    ledger: ledgerService,
    payout: payoutService,
    eligibility: eligibilityService,
    fraud: fraudService,
    dashboard: dashboardService,
    payoutProviderRegistry,
    publicApi,

    async shutdown() {
      logger.debug('Referral module shutdown');
    },
  };
}

export default createReferralModule;