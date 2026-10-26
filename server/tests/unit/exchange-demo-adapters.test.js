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

test('exchange adapters look up uncertain orders by client order ID', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    const address = new URL(String(url));
    let body;
    if (address.hostname.includes('binance')) {
      body = {
        orderId: 123,
        clientOrderId: 'sync-client-order',
        status: 'NEW',
        executedQty: '0',
        origQty: '1',
        avgPrice: '',
      };
    } else if (address.hostname.includes('okx')) {
      body = {
        code: '0',
        data: [{
          ordId: 'okx-order',
          clOrdId: 'sync-client-order',
          state: 'live',
          accFillSz: '0',
          avgPx: '',
        }],
      };
    } else {
      body = {
        code: '00000',
        data: {
          orderId: 'bitget-order',
          clientOid: 'sync-client-order',
          status: 'live',
          baseVolume: '0',
          priceAvg: '',
        },
      };
    }
    return { ok: true, text: async () => JSON.stringify(body) };
  };

  try {
    const binance = createBinanceAdapter({ config: {}, logger: {} });
    const okx = createOkxAdapter({ config: {}, logger: {} });
    const bitget = createBitgetAdapter({ config: {}, logger: {} });
    const credentials = {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      passphrase: 'test-passphrase',
      environment: 'testnet',
      instrument: 'BTCUSDT',
      clientOrderId: 'sync-client-order',
    };

    const binanceUpdate = await binance.fetchOrder({
      ...credentials,
      accountType: 'spot',
    });
    const okxUpdate = await okx.fetchOrder(credentials);
    const bitgetUpdate = await bitget.fetchOrder({
      ...credentials,
      accountType: 'spot',
    });

    assert.equal(new URL(requestedUrls[0]).searchParams.get('origClientOrderId'), 'sync-client-order');
    assert.equal(new URL(requestedUrls[1]).searchParams.get('clOrdId'), 'sync-client-order');
    assert.equal(new URL(requestedUrls[2]).searchParams.get('clientOid'), 'sync-client-order');
    assert.equal(binanceUpdate.clientOrderId, 'sync-client-order');
    assert.equal(okxUpdate.clientOrderId, 'sync-client-order');
    assert.equal(bitgetUpdate.clientOrderId, 'sync-client-order');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
