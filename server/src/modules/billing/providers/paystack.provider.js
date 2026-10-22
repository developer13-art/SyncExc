/**
 * SyncExc Server — Paystack payment provider
 */

import { ExternalProviderError } from '../../../lib/errors.js';

export function createPaystackProvider({ config, logger }) {
  return {
    name: 'paystack',

    async createCheckout({ amountMinor, currency, reference, successUrl, customer }) {
      const res = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: customer.email,
          amount: amountMinor,
          currency,
          reference,
          callback_url: successUrl,
        }),
      });
      const body = await res.json();
      if (!res.ok || body.status !== true || !body.data?.authorization_url) {
        logger?.error(
          { provider: 'paystack', status: res.status, providerMessage: body.message },
          'Paystack checkout initialization failed',
        );
        throw new ExternalProviderError(
          'Paystack could not start checkout. Verify the server Paystack secret key, currency, and account settings.',
          {
            provider: 'paystack',
            status: 502,
            retryable: res.status >= 500,
            details: { stage: 'checkout initialization', providerStatus: res.status },
          },
        );
      }
      return { id: body.data.reference, redirectUrl: body.data.authorization_url };
    },

    async parseWebhookEvent({ event }) {
      switch (event.event) {
        case 'charge.success':
          return {
            eventId: `${event.data.id}`,
            eventType: 'payment.succeeded',
            raw: event,
            data: {
              providerPaymentReference: event.data.reference,
              checkoutReference: event.data.reference,
              amountMinor: event.data.amount,
              currency: event.data.currency,
            },
          };
        default:
          return null;
      }
    },

    async refundPayment({ providerPaymentReference, amountMinor }) {
      const res = await fetch('https://api.paystack.co/refund', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction: providerPaymentReference,
          amount: amountMinor,
        }),
      });
      if (!res.ok) throw new Error(`Paystack refund failed: ${res.status}`);
      const body = await res.json();
      return { id: body.data.id, status: body.data.status };
    },
  };
}

export default createPaystackProvider;