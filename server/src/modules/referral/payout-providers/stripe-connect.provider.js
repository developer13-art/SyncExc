/**
 * SyncExc Server — Stripe Connect payout provider
 *
 * Real integration with Stripe Connect Transfers API.
 */

export function createStripeConnectPayoutProvider({ config, logger }) {
  let stripe;

  async function ensureClient() {
    if (stripe) return stripe;
    let Stripe;
    try {
      Stripe = (await import('stripe')).default;
    } catch {
      throw new Error('stripe SDK not installed but Stripe Connect is enabled');
    }
    stripe = new Stripe(config.secretKey, { apiVersion: '2024-06-20' });
    return stripe;
  }

  return {
    name: 'stripe_connect',

    async createPayout({ amountMinor, currency, providerToken, reference, metadata }) {
      try {
        const client = await ensureClient();
        const transfer = await client.transfers.create({
          amount: amountMinor,
          currency: currency.toLowerCase(),
          destination: providerToken,
          transfer_group: reference,
          metadata: {
            syncexc_reference: reference,
            affiliate_id: metadata?.affiliateId || '',
          },
        });

        return {
          ok: true,
          providerTxId: transfer.id,
          status: transfer.reversed ? 'failed' : 'paid',
          raw: transfer,
        };
      } catch (err) {
        logger.error({ err, reference }, 'Stripe Connect transfer failed');
        return {
          ok: false,
          error: err.message,
          raw: err,
        };
      }
    },

    async getStatus({ providerTxId }) {
      try {
        const client = await ensureClient();
        const transfer = await client.transfers.retrieve(providerTxId);
        return {
          ok: true,
          status: transfer.reversed ? 'failed' : 'paid',
          raw: transfer,
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  };
}

export default createStripeConnectPayoutProvider;