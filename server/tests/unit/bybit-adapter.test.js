import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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

test('signs Bybit GET requests using the exact URL query string', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestHeaders;
  globalThis.fetch = async (url, options) => {
    requestUrl = String(url);
    requestHeaders = options.headers;
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          retCode: 0,
          result: { list: [] },
        }),
    };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    const credentials = {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      environment: 'demo',
    };

    await adapter.validateCredentials(credentials);
    assert.equal(requestHeaders['X-BAPI-SIGN'], expectedSignature({
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      timestamp: requestHeaders['X-BAPI-TIMESTAMP'],
      query: '',
    }));

    await adapter.fetchBalances(credentials);
    const query = new URL(requestUrl).searchParams.toString();
    assert.equal(query, 'accountType=UNIFIED');
    assert.equal(requestHeaders['X-BAPI-SIGN'], expectedSignature({
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      timestamp: requestHeaders['X-BAPI-TIMESTAMP'],
      query,
    }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('uses IOC for Bybit market orders and preserves limit time-in-force', async () => {
  const originalFetch = globalThis.fetch;
  const requestBodies = [];
  globalThis.fetch = async (_url, options) => {
    requestBodies.push(JSON.parse(options.body));
    return {
      ok: true,
      text: async () =>
        JSON.stringify({ retCode: 0, result: { orderId: 'order-id', orderLinkId: 'client-id' } }),
    };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    const credentials = {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      environment: 'testnet',
    };
    const baseOrder = {
      instrument: 'BTCUSDT',
      marketType: 'futures',
      side: 'buy',
      quantity: '0.01',
    };

    await adapter.placeOrder({ ...credentials, order: { ...baseOrder, type: 'market', timeInForce: 'GTC' } });
    await adapter.placeOrder({
      ...credentials,
      order: { ...baseOrder, type: 'limit', price: '50000', timeInForce: 'GTC' },
    });

    assert.equal(requestBodies[0].orderType, 'Market');
    assert.equal(requestBodies[0].timeInForce, 'IOC');
    assert.equal(requestBodies[1].orderType, 'Limit');
    assert.equal(requestBodies[1].timeInForce, 'GTC');
    assert.equal(requestBodies[1].price, '50000');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetches Bybit order status from the matching market category', async () => {
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
            list: [{
              orderId: 'exchange-order-id',
              orderStatus: 'Filled',
              cumExecQty: '1',
              leavesQty: '0',
              avgPrice: '100',
            }],
          },
        }),
    };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    const credentials = {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      environment: 'demo',
      instrument: 'BTCUSDT',
      exchangeOrderId: 'exchange-order-id',
    };
    await adapter.fetchOrder({ ...credentials, marketType: 'spot' });
    await adapter.fetchOrder({ ...credentials, marketType: 'futures' });

    assert.equal(new URL(requestedUrls[0]).searchParams.get('category'), 'spot');
    assert.equal(new URL(requestedUrls[1]).searchParams.get('category'), 'linear');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('falls back to Bybit order history when a closed order is absent from realtime orders', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    const isHistory = String(url).includes('/v5/order/history');
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          retCode: 0,
          result: {
            list: isHistory
              ? [{
                  orderId: 'exchange-order-id',
                  orderStatus: 'Filled',
                  cumExecQty: '5000',
                  leavesQty: '0',
                  avgPrice: '0.2418',
                }]
              : [],
          },
        }),
    };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    const order = await adapter.fetchOrder({
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      environment: 'demo',
      instrument: 'OGUSDT',
      exchangeOrderId: 'exchange-order-id',
      marketType: 'futures',
    });

    assert.deepEqual(requestedUrls.map((url) => new URL(url).pathname), [
      '/v5/order/realtime',
      '/v5/order/history',
    ]);
    assert.equal(order.status, 'filled');
    assert.equal(order.filledQuantity, '5000');
    assert.equal(order.averageFillPrice, '0.2418');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns Bybit wallet equity with the account balances', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => JSON.stringify({
      retCode: 0,
      result: {
        list: [{
          totalEquity: '50123.45',
          coin: [{
            coin: 'USDT',
            availableToWithdraw: '123.45',
            locked: '0',
            walletBalance: '123.45',
          }],
        }],
      },
    }),
  });

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    const state = await adapter.fetchAccountState({
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      environment: 'demo',
    });
    assert.equal(state.equity, '50123.45');
    assert.deepEqual(state.balances, [{
      asset: 'USDT',
      free: '123.45',
      used: '0',
      total: '123.45',
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function expectedSignature({ apiKey, apiSecret, timestamp, query, recvWindow = '5000' }) {
  return crypto
    .createHmac('sha256', apiSecret)
    .update(`${timestamp}${apiKey}${recvWindow}${query}`)
    .digest('hex');
}
