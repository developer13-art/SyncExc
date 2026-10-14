/**
 * SyncExc Server — Base exchange adapter
 *
 * Provides shared helpers for every exchange adapter:
 *   - signed HTTP requests with HMAC
 *   - rate-limit-aware request scheduling
 *   - error normalization
 *   - retry with bounded backoff
 *
 * Adapters extend this by implementing the required methods:
 *   - validateCredentials
 *   - discoverAccounts
 *   - fetchBalances
 *   - fetchInstruments
 *   - placeOrder
 *   - cancelOrder
 *   - fetchOrder
 *   - fetchOpenOrders
 *   - fetchPositions
 *   - subscribe (WebSocket)
 */

import crypto from 'node:crypto';
import { retry } from '@syncexc/shared';

export function createBaseAdapter({ exchangeCode, restBaseUrl, config, logger }) {
  return {
    exchangeCode,
    restBaseUrl,
    capabilities: {
      hasSpot: true,
      hasFutures: false,
      hasMargin: false,
      hasSubaccounts: false,
      hasWebsocket: false,
      supportedOrderTypes: ['market', 'limit'],
      supportedTimeInForce: ['GTC', 'IOC', 'FOK'],
    },

    /**
     * Sign a request body using HMAC-SHA256. Return the signature string.
     * Subclasses override this with exchange-specific header/parameter names.
     */
    signRequest(secret, payload) {
      return crypto.createHmac('sha256', secret).update(payload).digest('hex');
    },

    /**
     * Generic fetch with timeout + retry.
     */
    async fetchSigned({ url, method = 'GET', headers = {}, body = null, timeoutMs = 15000 }) {
      return retry(
        async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const res = await fetch(url, {
              method,
              headers,
              body: body ? JSON.stringify(body) : undefined,
              signal: controller.signal,
            });

            const text = await res.text();
            let json = null;
            try {
              json = text ? JSON.parse(text) : null;
            } catch {
              json = { raw: text };
            }

            if (!res.ok) {
              const err = new Error(
                `Exchange request failed: ${res.status} ${json?.msg || json?.message || ''}`
              );
              err.statusCode = res.status;
              err.exchangeResponse = json;
              throw err;
            }

            return json;
          } finally {
            clearTimeout(timer);
          }
        },
        { attempts: config?.exchange?.maxRetries || 3, baseMs: 500, maxMs: 8000 }
      );
    },

    /**
     * Normalize an exchange error into a stable shape.
     */
    normalizeError(err) {
      return {
        code: err.exchangeResponse?.code || err.statusCode || 'EXCHANGE_ERROR',
        message: err.message,
        retryable: err.statusCode === 429 || (err.statusCode >= 500 && err.statusCode < 600),
        raw: err.exchangeResponse || null,
      };
    },
  };
}

export default createBaseAdapter;