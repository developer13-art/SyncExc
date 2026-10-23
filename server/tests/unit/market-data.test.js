import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarketDataService } from '../../src/modules/connections/market-data.service.js';

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('market data service normalizes Binance candles, depth, trades and ticker without credentials', async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    requests.push(parsed);
    if (parsed.pathname.endsWith('/klines')) {
      return jsonResponse([
        [1700000000000, '10', '13', '9', '12', '25'],
        [1700003600000, '12', '15', '11', '14', '35'],
      ]);
    }
    if (parsed.pathname.endsWith('/depth')) {
      return jsonResponse({
        bids: [['13', '2']],
        asks: [['14', '3']],
        lastUpdateId: 42,
      });
    }
    if (parsed.pathname.endsWith('/trades')) {
      return jsonResponse([{ price: '13.5', qty: '0.75', isBuyerMaker: false, time: 1700003600000 }]);
    }
    if (parsed.pathname.endsWith('/ticker/24hr')) {
      return jsonResponse({
        lastPrice: '14',
        priceChangePercent: '4.2',
        highPrice: '15',
        lowPrice: '9',
        quoteVolume: '1000',
        closeTime: Date.now(),
      });
    }
    throw new Error(`Unexpected market-data path: ${parsed.pathname}`);
  };
  const marketData = createMarketDataService({ fetchImpl });

  const result = await marketData.getMarketData({
    exchangeCode: 'binance',
    symbol: 'BTCUSDT',
    marketType: 'spot',
    timeframe: '1h',
    limit: 50,
  });

  assert.equal(result.source, 'exchange:binance');
  assert.equal(result.candles.length, 2);
  assert.equal(result.candles[1].close, 14);
  assert.deepEqual(result.orderBook.bids[0], { price: 13, quantity: 2, total: 26 });
  assert.equal(result.recentTrades[0].side, 'buy');
  assert.equal(result.overview.lastPrice, 14);
  assert.equal(result.sections.candles.status, 'available');
  assert.ok(requests.every((url) => url.origin === 'https://api.binance.com'));
});

test('market data service rejects unrecognized exchanges and symbols', async () => {
  const marketData = createMarketDataService({ fetchImpl: async () => { throw new Error('must not fetch'); } });
  await assert.rejects(
    marketData.getMarketData({ exchangeCode: 'unknown', symbol: 'BTCUSDT' }),
    { code: 'VALIDATION_ERROR' },
  );
  await assert.rejects(
    marketData.getMarketData({ exchangeCode: 'binance', symbol: 'https://example.com' }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('market data service preserves extended and case-sensitive Binance intervals', async () => {
  const requests = [];
  const marketData = createMarketDataService({
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      return jsonResponse({});
    },
  });

  for (const timeframe of ['30m', '1w', '1M']) {
    await marketData.getMarketData({
      exchangeCode: 'binance',
      symbol: 'BTCUSDT',
      timeframe,
    });
  }

  const intervals = requests
    .filter((url) => url.pathname.endsWith('/klines'))
    .map((url) => url.searchParams.get('interval'));
  assert.deepEqual(intervals, ['30m', '1w', '1M']);
  await assert.rejects(
    marketData.getMarketData({
      exchangeCode: 'bitget',
      symbol: 'BTCUSDT',
      timeframe: '1M',
    }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('spot price lookup fetches and caches a normalized exchange ticker', async () => {
  const requests = [];
  const marketData = createMarketDataService({
    fetchImpl: async (url) => {
      requests.push(String(url));
      return jsonResponse({
        retCode: 0,
        result: { list: [{ lastPrice: '65000.25' }] },
      });
    },
  });

  const firstPrice = await marketData.getSpotPrice({
    exchangeCode: 'bybit',
    symbol: 'BTCUSDT',
  });
  const secondPrice = await marketData.getSpotPrice({
    exchangeCode: 'bybit',
    symbol: 'BTCUSDT',
  });

  assert.equal(firstPrice, 65000.25);
  assert.equal(secondPrice, 65000.25);
  assert.equal(requests.length, 1);
  assert.ok(requests[0].startsWith('https://api.bybit.com/v5/market/tickers?category=spot'));
});
