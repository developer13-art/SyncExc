/**
 * SyncExc Server — Paystack Transfer payout provider
 */

export function createPaystackTransferPayoutProvider({ config, logger }) {
  return {
    name: 'paystack_transfer',

    async createPayout({ amountMinor, currency, providerToken, reference, metadata }) {
      try {
        const res = await fetch('https://api.paystack.co/transfer', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: 'balance',
            amount: amountMinor,
            currency,
            recipient: providerToken,
            reason: `SyncExc referral payout (${reference})`,
            reference,
          }),
        });

        const body = await res.json();
        if (!res.ok || !body.status) {
          return { ok: false, error: body.message || `HTTP ${res.status}`, raw: body };
        }

        const status = body.data?.status === 'success' ? 'paid' : 'processing';
        return {
          ok: true,
          providerTxId: String(body.data.transfer_code || body.data.reference),
          status,
          raw: body.data,
        };
      } catch (err) {
        logger.error({ err, reference }, 'Paystack transfer failed');
        return { ok: false, error: err.message };
      }
    },

    async getStatus({ providerTxId }) {
      try {
        const res = await fetch(
          `https://api.paystack.co/transfer/${providerTxId}`,
          { headers: { Authorization: `Bearer ${config.secretKey}` } }
        );
        const body = await res.json();
        if (!res.ok || !body.status) {
          return { ok: false, error: body.message || `HTTP ${res.status}` };
        }
        return {
          ok: true,
          status: body.data.status === 'success' ? 'paid' : body.data.status,
          raw: body.data,
        };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  };
}

export default createPaystackTransferPayoutProvider;