/**
 * SyncExc Server — Flutterwave payment provider
 */

import { ExternalProviderError } from '../../../lib/errors.js';

export function createFlutterwaveProvider({ config, logger }) {
  return {
    name: 'flutterwave',

    async createCheckout({ amountMinor, currency, reference, successUrl, customer }) {
      const res = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: reference,
          amount: amountMinor / 100,
          currency,
          redirect_url: successUrl,
          customer: { email: customer.email },
        }),
      });
      const body = await res.json();
      if (!res.ok || body.status !== 'success' || !body.data?.link) {
        logger?.error(
          { provider: 'flutterwave', status: res.status, providerMessage: body.message },
          'Flutterwave checkout initialization failed',
        );
        throw new ExternalProviderError(
          'Flutterwave could not start checkout. Verify the server Flutterwave secret key, currency, and account settings.',
          {
            provider: 'flutterwave',
            status: 502,
            retryable: res.status >= 500,
            details: { stage: 'checkout initialization', providerStatus: res.status },
          },
        );
      }
      return { id: body.data.tx_ref, redirectUrl: body.data.link };
    },

    async parseWebhookEvent({ event }) {
      if (event.event === 'charge.completed' && event.data.status === 'successful') {
        return {
          eventId: `${event.data.id}`,
          eventType: 'payment.succeeded',
          raw: event,
          data: {
            providerPaymentReference: `${event.data.id}`,
            checkoutReference: event.data.tx_ref,
            amountMinor: Math.round(event.data.amount * 100),
            currency: event.data.currency,
          },
        };
      }
      return null;
    },

    async refundPayment({ providerPaymentReference, amountMinor }) {
      const res = await fetch(
        `https://api.flutterwave.com/v3/transactions/${providerPaymentReference}/refund`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount: amountMinor / 100 }),
        }
      );
      if (!res.ok) throw new Error(`Flutterwave refund failed: ${res.status}`);
      const body = await res.json();
      return { id: body.data.id, status: body.data.status };
    },
  };
}

export default createFlutterwaveProvider;