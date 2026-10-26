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

test('explains Bybit API key, IP allowlist, and trading permission rejections', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => JSON.stringify({
      retCode: 10003,
      retMsg: 'Invalid API-key, IP, or permissions for action.',
      result: {},
    }),
  });

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    await assert.rejects(
      adapter.placeOrder({
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        environment: 'testnet',
        order: {
          instrument: 'BTCUSDT',
          marketType: 'spot',
          side: 'buy',
          type: 'market',
          quantity: '0.01',
        },
      }),
      (error) => {
        assert.match(error.message, /server IP is allowlisted/);
        assert.match(error.message, /trading access is enabled/);
        assert.equal(error.exchangeResponse.retCode, 10003);
        return true;
      }
    );
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

test('fetches and normalizes Bybit closed P&L history', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      text: async () => JSON.stringify({
        retCode: 0,
        result: {
          list: [{
            orderId: 'close-order',
            symbol: 'BTCUSDT',
            side: 'Buy',
            closedSize: '0.25',
            avgEntryPrice: '60000',
            avgExitPrice: '61000',
            closedPnl: '250',
            closeFee: '1.5',
            settleCoin: 'USDT',
            createdTime: '1720000000000',
            updatedTime: '1720000001000',
          }],
          nextPageCursor: 'next-page',
        },
      }),
    };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    const result = await adapter.fetchClosedPnl({
      apiKey: 'api-key',
      apiSecret: 'api-secret',
      environment: 'demo',
      startTime: 1720000000000,
    });

    assert.equal(new URL(requestedUrl).pathname, '/v5/position/closed-pnl');
    assert.equal(new URL(requestedUrl).searchParams.get('startTime'), '1720000000000');
    assert.equal(result.nextCursor, 'next-page');
    assert.deepEqual(result.trades[0], {
      exchangeTradeId: 'close-order:1720000000000:0.25',
      exchangeOrderId: 'close-order',
      instrument: 'BTCUSDT',
      side: 'long',
      quantity: '0.25',
      entryPrice: '60000',
      exitPrice: '61000',
      realizedPnl: '250',
      pnlAsset: 'USDT',
      feeAmount: '1.5',
      feeAsset: 'USDT',
      closedAt: '1720000001000',
      exchangePayload: {
        orderId: 'close-order',
        symbol: 'BTCUSDT',
        side: 'Buy',
        closedSize: '0.25',
        avgEntryPrice: '60000',
        avgExitPrice: '61000',
        closedPnl: '250',
        closeFee: '1.5',
        settleCoin: 'USDT',
        createdTime: '1720000000000',
        updatedTime: '1720000001000',
      },
    });
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

test('submits futures entry orders with attached stop-loss and take-profit protection', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      text: async () => JSON.stringify({ retCode: 0, result: { orderId: 'protected-order' } }),
    };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    await adapter.placeOrder({
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      environment: 'testnet',
      order: {
        instrument: 'BTCUSDT',
        marketType: 'futures',
        side: 'buy',
        type: 'market',
        quantity: '0.01',
        stopLoss: '59000',
        takeProfit: '62000',
      },
    });

    assert.equal(requestBody.tpslMode, 'Full');
    assert.equal(requestBody.stopLoss, '59000');
    assert.equal(requestBody.takeProfit, '62000');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('submits supported Bybit Spot limit orders with native market TP/SL protection', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      text: async () => JSON.stringify({ retCode: 0, result: { orderId: 'spot-protected-order' } }),
    };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    assert.deepEqual(
      adapter.capabilities.hasAttachedBracketProtectionOrderTypes.spot,
      ['limit'],
    );
    await adapter.placeOrder({
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      environment: 'testnet',
      order: {
        instrument: 'BTCUSDT',
        marketType: 'spot',
        side: 'buy',
        type: 'limit',
        quantity: '0.01',
        price: '28000',
        stopLoss: '27000',
        takeProfit: '35000',
      },
    });

    assert.equal(requestBody.category, 'spot');
    assert.equal(requestBody.orderType, 'Limit');
    assert.equal(requestBody.tpOrderType, 'Market');
    assert.equal(requestBody.slOrderType, 'Market');
    assert.equal(requestBody.stopLoss, '27000');
    assert.equal(requestBody.takeProfit, '35000');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects unsupported Bybit Spot market orders with attached TP/SL', async () => {
  const adapter = createBybitAdapter({ config: {}, logger: {} });
  await assert.rejects(
    adapter.placeOrder({
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      environment: 'testnet',
      order: {
        instrument: 'BTCUSDT',
        marketType: 'spot',
        side: 'buy',
        type: 'market',
        quantity: '0.01',
        stopLoss: '27000',
        takeProfit: '35000',
      },
    }),
    /not supported for this market and order type/,
  );
});

test('submits Bybit stop-market orders with a validated trigger direction', async () => {
  const originalFetch = globalThis.fetch;
  const requestBodies = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('/v5/market/tickers')) {
      return {
        ok: true,
        text: async () => JSON.stringify({
          retCode: 0,
          result: { list: [{ lastPrice: '100' }] },
        }),
      };
    }
    requestBodies.push(JSON.parse(options.body));
    return {
      ok: true,
      text: async () =>
        JSON.stringify({ retCode: 0, result: { orderId: 'conditional-order-id' } }),
    };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    const credentials = {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      environment: 'demo',
    };
    const order = {
      instrument: 'BTCUSDT',
      marketType: 'futures',
      side: 'sell',
      type: 'stop_market',
      quantity: '0.01',
      triggerPrice: '95',
      reduceOnly: true,
      timeInForce: 'GTC',
    };
    await adapter.placeOrder({ ...credentials, order });

    assert.equal(requestBodies.length, 1);
    assert.equal(requestBodies[0].category, 'linear');
    assert.equal(requestBodies[0].orderType, 'Market');
    assert.equal(requestBodies[0].triggerPrice, '95');
    assert.equal(requestBodies[0].triggerDirection, 2);
    assert.equal(requestBodies[0].triggerBy, 'LastPrice');
    assert.equal(requestBodies[0].reduceOnly, true);
    assert.equal(requestBodies[0].timeInForce, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('submits Bybit stop-limit orders with their trigger and limit prices', async () => {
  const originalFetch = globalThis.fetch;
  const requestBodies = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('/v5/market/tickers')) {
      return {
        ok: true,
        text: async () => JSON.stringify({
          retCode: 0,
          result: { list: [{ lastPrice: '100' }] },
        }),
      };
    }
    requestBodies.push(JSON.parse(options.body));
    return {
      ok: true,
      text: async () =>
        JSON.stringify({ retCode: 0, result: { orderId: 'conditional-order-id' } }),
    };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    await adapter.placeOrder({
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      environment: 'demo',
      order: {
        instrument: 'BTCUSDT',
        marketType: 'perpetual',
        side: 'buy',
        type: 'stop_limit',
        quantity: '0.01',
        price: '96',
        triggerPrice: '95',
        timeInForce: 'GTC',
      },
    });

    assert.equal(requestBodies[0].category, 'linear');
    assert.equal(requestBodies[0].orderType, 'Limit');
    assert.equal(requestBodies[0].price, '96');
    assert.equal(requestBodies[0].triggerPrice, '95');
    assert.equal(requestBodies[0].triggerDirection, 2);
    assert.equal(requestBodies[0].timeInForce, 'GTC');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects Bybit conditional orders when the trigger matches current price', async () => {
  const originalFetch = globalThis.fetch;
  let createRequested = false;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/v5/market/tickers')) {
      return {
        ok: true,
        text: async () => JSON.stringify({
          retCode: 0,
          result: { list: [{ lastPrice: '100' }] },
        }),
      };
    }
    createRequested = true;
    return { ok: true, text: async () => JSON.stringify({ retCode: 0, result: {} }) };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    await assert.rejects(
      adapter.placeOrder({
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        environment: 'demo',
        order: {
          instrument: 'BTCUSDT',
          marketType: 'futures',
          side: 'buy',
          type: 'stop_market',
          quantity: '0.01',
          triggerPrice: '100',
        },
      }),
      /trigger price must differ from the current last price/
    );
    assert.equal(createRequested, false);
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

test('uses execution records to confirm a filled Bybit order with a blank average price', async () => {
  const originalFetch = globalThis.fetch;
  const requestedPaths = [];
  globalThis.fetch = async (url) => {
    const path = new URL(String(url)).pathname;
    requestedPaths.push(path);
    const result = path === '/v5/order/realtime'
      ? {
          list: [{
            orderId: 'exchange-order-id',
            orderStatus: 'Filled',
            cumExecQty: '2',
            leavesQty: '0',
            avgPrice: '',
          }],
        }
      : {
          list: [{
            execId: 'trade-1',
            orderId: 'exchange-order-id',
            symbol: 'BTCUSDT',
            side: 'Buy',
            execQty: '2',
            execPrice: '100',
            execFee: '0.1',
            feeCurrency: 'USDT',
            execTime: '1793000000000',
          }],
        };
    return {
      ok: true,
      text: async () => JSON.stringify({ retCode: 0, result }),
    };
  };

  try {
    const adapter = createBybitAdapter({ config: {}, logger: {} });
    const update = await adapter.fetchOrder({
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      environment: 'demo',
      instrument: 'BTCUSDT',
      exchangeOrderId: 'exchange-order-id',
      marketType: 'spot',
    });

    assert.deepEqual(requestedPaths, ['/v5/order/realtime', '/v5/execution/list']);
    assert.equal(update.status, 'filled');
    assert.equal(update.averageFillPrice, '100');
    assert.equal(update.fills[0].exchangeTradeId, 'trade-1');
    assert.equal(update.fills[0].feeAsset, 'USDT');
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
          totalAvailableBalance: '120.00',
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
    assert.equal(state.availableEquity, '120.00');
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
