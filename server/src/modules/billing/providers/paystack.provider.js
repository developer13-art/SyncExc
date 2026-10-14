/**
 * SyncExc Server — Paystack payment provider
 */

export function createPaystackProvider({ config, logger }) {
  return {
    name: 'paystack',

    async createCheckout({ amountMinor, currency, reference, successUrl, cancelUrl }) {
      const res = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'customer@example.com',
          amount: amountMinor,
          currency,
          reference,
          callback_url: successUrl,
        }),
      });
      if (!res.ok) throw new Error(`Paystack init failed: ${res.status}`);
      const body = await res.json();
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