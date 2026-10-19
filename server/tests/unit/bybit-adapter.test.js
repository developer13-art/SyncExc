import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBybitAdapter } from '../../src/modules/connections/adapters/bybit.adapter.js';

test('routes Bybit private requests to the selected environment', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          retCode: 0,
          result: {
            permissions: { Spot: true },
            list: [],
            orderId: 'order-id',
          },
        }),
    };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    const credentials = {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      environment: 'testnet',
    };

    await adapter.validateCredentials(credentials);
    await adapter.fetchBalances(credentials);
    await adapter.placeOrder({
      ...credentials,
      order: {
        instrument: 'BTCUSDT',
        marketType: 'spot',
        side: 'buy',
        type: 'market',
        quantity: '0.01',
      },
    });

    assert.equal(requestedUrls.length, 3);
    assert.ok(requestedUrls.every((url) => url.startsWith('https://api-testnet.bybit.com/')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('defaults Bybit private requests to mainnet', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      text: async () => JSON.stringify({ retCode: 0, result: { permissions: {} } }),
    };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    await adapter.validateCredentials({ apiKey: 'api-key', apiSecret: 'api-secret' });
    assert.ok(requestedUrl.startsWith('https://api.bybit.com/'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('routes Bybit demo credentials to the demo API', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      text: async () => JSON.stringify({ retCode: 0, result: { permissions: {} } }),
    };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    await adapter.validateCredentials({
      apiKey: 'demo-api-key',
      apiSecret: 'demo-api-secret',
      environment: 'demo',
    });
    assert.ok(requestedUrl.startsWith('https://api-demo.bybit.com/'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
