/**
 * SyncExc Server — Payout provider registry
 */

import { createLogger } from '../../../lib/logger.js';
import { createStripeConnectPayoutProvider } from './stripe-connect.provider.js';
import { createPaystackTransferPayoutProvider } from './paystack-transfer.provider.js';

export function createPayoutProviderRegistry({ logger, config }) {
  const log = logger || createLogger({ component: 'referral:payout-providers' });

  const providers = new Map();

  if (config?.payouts?.stripeConnect?.enabled) {
    providers.set('stripe_connect', createStripeConnectPayoutProvider({
      config: config.payouts.stripeConnect,
      logger: log,
    }));
  }

  if (config?.payouts?.paystackTransfer?.enabled) {
    providers.set('paystack_transfer', createPaystackTransferPayoutProvider({
      config: config.payouts.paystackTransfer,
      logger: log,
    }));
  }

  log.info({ providers: Array.from(providers.keys()) }, 'Payout provider registry initialized');

  return {
    get(name) {
      return providers.get(name) || null;
    },
    list() {
      return Array.from(providers.keys());
    },
  };
}

export default createPayoutProviderRegistry;