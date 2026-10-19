import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBitgetAdapter } from '../../src/modules/connections/adapters/bitget.adapter.js';
import { createOkxAdapter } from '../../src/modules/connections/adapters/okx.adapter.js';
import { createBinanceAdapter } from '../../src/modules/connections/adapters/binance.adapter.js';

test('Bitget demo requests include the simulated trading header', async () => {
  const originalFetch = globalThis.fetch;
  let requestHeaders;
  globalThis.fetch = async (_url, options) => {
    requestHeaders = options.headers;
    return {
      ok: true,
      text: async () => JSON.stringify({ code: '00000', data: [] }),
    };
  };

  try {
    const adapter = createBitgetAdapter({ config: {}, logger: {} });
    await adapter.validateCredentials({
      apiKey: 'demo-api-key',
      apiSecret: 'demo-api-secret',
      passphrase: 'demo-passphrase',
      environment: 'demo',
    });
    assert.equal(requestHeaders.paptrading, '1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OKX demo requests include the simulated trading header', async () => {
  const originalFetch = globalThis.fetch;
  let requestHeaders;
  globalThis.fetch = async (_url, options) => {
    requestHeaders = options.headers;
    return {
      ok: true,
      text: async () => JSON.stringify({ code: '0', data: [] }),
    };
  };

  try {
    const adapter = createOkxAdapter({ config: {}, logger: {} });
    await adapter.validateCredentials({
      apiKey: 'demo-api-key',
      apiSecret: 'demo-api-secret',
      passphrase: 'demo-passphrase',
      environment: 'demo',
    });
    assert.equal(requestHeaders['x-simulated-trading'], '1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Binance testnet credentials use the Spot testnet endpoint', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      text: async () => JSON.stringify({ balances: [], permissions: [] }),
    };
  };

  try {
    const adapter = createBinanceAdapter({ config: {}, logger: {} });
    await adapter.validateCredentials({
      apiKey: 'testnet-api-key',
      apiSecret: 'testnet-api-secret',
      environment: 'testnet',
    });
    assert.ok(requestedUrl.startsWith('https://testnet.binance.vision/'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
