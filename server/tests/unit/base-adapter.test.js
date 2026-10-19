import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBaseAdapter } from '../../src/modules/connections/adapters/base.adapter.js';

test('does not retry permanent 4xx exchange responses', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return {
      ok: false,
      status: 451,
      text: async () => JSON.stringify({ msg: 'Restricted location' }),
    };
  };

  try {
    const adapter = createBaseAdapter({
      exchangeCode: 'binance',
      restBaseUrl: 'https://api.binance.com',
      config: { exchange: { maxRetries: 3 } },
      logger: {},
    });

    await assert.rejects(
      adapter.fetchSigned({ url: 'https://api.binance.com/api/v3/account' }),
      (error) => error.statusCode === 451 && error.retryable === false,
    );
    assert.equal(requestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
