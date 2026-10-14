/**
 * SyncExc Server — Stripe payment provider
 */

export function createStripeProvider({ config, logger }) {
  let stripe;

  async function ensureClient() {
    if (stripe) return stripe;
    let Stripe;
    try {
      Stripe = (await import('stripe')).default;
    } catch {
      throw new Error('stripe SDK not installed but Stripe is enabled');
    }
    stripe = new Stripe(config.secretKey, { apiVersion: '2024-06-20' });
    return stripe;
  }

  return {
    name: 'stripe',

    async createCheckout({ amountMinor, currency, reference, successUrl, cancelUrl }) {
      const client = await ensureClient();
      const session = await client.checkout.sessions.create({
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: { name: 'SyncExc Subscription' },
              unit_amount: amountMinor,
            },
            quantity: 1,
          },
        ],
        client_reference_id: reference,
        metadata: { syncexc_reference: reference },
      });
      return { id: session.id, redirectUrl: session.url };
    },

    async parseWebhookEvent({ event }) {
      switch (event.type) {
        case 'checkout.session.completed':
          return {
            eventId: event.id,
            eventType: 'payment.succeeded',
            raw: event,
            data: {
              providerPaymentReference: event.data.object.payment_intent,
              checkoutReference: event.data.object.client_reference_id,
              amountMinor: event.data.object.amount_total,
              currency: event.data.object.currency.toUpperCase(),
              customerEmail: event.data.object.customer_details?.email,
            },
          };
        case 'charge.refunded':
          return {
            eventId: event.id,
            eventType: 'refund.completed',
            raw: event,
            data: {
              refundReference: event.data.object.refunds?.data?.[0]?.id,
              amountMinor: event.data.object.amount_refunded,
              currency: event.data.object.currency.toUpperCase(),
            },
          };
        default:
          return null;
      }
    },

    async refundPayment({ providerPaymentReference, amountMinor, reason }) {
      const client = await ensureClient();
      const refund = await client.refunds.create({
        payment_intent: providerPaymentReference,
        amount: amountMinor,
        reason: reason || 'requested_by_customer',
      });
      return { id: refund.id, status: refund.status };
    },
  };
}

export default createStripeProvider;