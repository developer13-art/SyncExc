/**
 * SyncExc Server — Payment provider factory
 *
 * Returns a provider implementation for the given name. Each provider
 * exposes:
 *   - createCheckout(opts)
 *   - parseWebhookEvent({ event, rawBody })
 *   - refundPayment(opts)
 */

import { createLogger } from '../../../lib/logger.js';
import { createStripeProvider } from './stripe.provider.js';
import { createPaystackProvider } from './paystack.provider.js';
import { createFlutterwaveProvider } from './flutterwave.provider.js';

export function createPaymentProviderFactory({ logger, stripe, paystack, flutterwave }) {
  const log = logger || createLogger({ component: 'billing:providers' });

  const providers = new Map();

  if (stripe?.enabled) {
    providers.set('stripe', createStripeProvider({ config: stripe, logger: log }));
  }
  if (paystack?.enabled) {
    providers.set('paystack', createPaystackProvider({ config: paystack, logger: log }));
  }
  if (flutterwave?.enabled) {
    providers.set('flutterwave', createFlutterwaveProvider({ config: flutterwave, logger: log }));
  }

  return {
    get(name) {
      return providers.get(name) || null;
    },
    list() {
      return Array.from(providers.keys());
    },
  };
}

export default createPaymentProviderFactory;