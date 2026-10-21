/**
 * Public, unauthenticated exchange market data.
 *
 * Requests are made only to fixed exchange hosts. Symbols and query values are
 * validated before they are placed in provider URLs; message/user-supplied URLs
 * are never fetched here.
 */
import { AppError, ValidationError } from '../../lib/errors.js';

const EXCHANGES = {
  binance: {
    spot: 'https://api.binance.com',
    futures: 'https://fapi.binance.com',
    timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
  },
  bybit: {
    spot: 'https://api.bybit.com',
    futures: 'https://api.bybit.com',
    timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
  },
  bitget: {
    spot: 'https://api.bitget.com',
    futures: 'https://api.bitget.com',
    timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
  },
  okx: {
    spot: 'https://www.okx.com',
    futures: 'https://www.okx.com',
    timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
  },
};

const CACHE_TTL_MS = 5_000;
const PRICE_CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 300;

const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function timestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCandles(rows, mapRow) {
  return (Array.isArray(rows) ? rows : [])
    .map(mapRow)
    .filter((candle) =>
      candle.timestamp !== null &&
      [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

function normalizeLevels(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((level) => ({
      price: asNumber(Array.isArray(level) ? level[0] : level.price),
      quantity: asNumber(Array.isArray(level) ? level[1] : level.quantity ?? level.size),
    }))
    .filter((level) => level.price !== null && level.quantity !== null)
    .map((level) => ({ ...level, total: level.price * level.quantity }));
}

function normalizeTrades(rows, mapTrade) {
  return (Array.isArray(rows) ? rows : [])
    .map(mapTrade)
    .filter((trade) => trade.price !== null && trade.quantity !== null)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export function normalizeMarketDataPayload(exchangeCode, payload, { now = Date.now() } = {}) {
  const data = payload || {};
  const candles = normalizeCandles(data.candles, (row) => row);
  const bids = normalizeLevels(data.orderBook?.bids);
  const asks = normalizeLevels(data.orderBook?.asks);
  const recentTrades = normalizeTrades(data.recentTrades, (trade) => trade);
  const overview = data.overview || {};

  return {
    exchangeCode,
    symbol: data.symbol,
    marketType: data.marketType,
    timeframe: data.timeframe,
    source: `exchange:${exchangeCode}`,
    retrievedAt: now,
    freshness: {
      state: data.sourceTimestamp && now - data.sourceTimestamp > 120_000 ? 'stale' : 'fresh',
      sourceTimestamp: data.sourceTimestamp || null,
      ageMs: data.sourceTimestamp ? Math.max(0, now - data.sourceTimestamp) : null,
    },
    candles,
    orderBook: { bids, asks, sourceTimestamp: timestamp(data.orderBook?.timestamp) },
    recentTrades,
    overview: {
      lastPrice: asNumber(overview.lastPrice),
      markPrice: asNumber(overview.markPrice),
      indexPrice: asNumber(overview.indexPrice),
      fundingRate: asNumber(overview.fundingRate),
      openInterest: asNumber(overview.openInterest),
      priceChangePercent: asNumber(overview.priceChangePercent),
      high24h: asNumber(overview.high24h),
      low24h: asNumber(overview.low24h),
      quoteVolume24h: asNumber(overview.quoteVolume24h),
      sourceTimestamp: timestamp(overview.timestamp),
    },
    sections: data.sections,
  };
}

function timeframeFor(exchangeCode, timeframe) {
  if (exchangeCode === 'bybit') {
    return ({ '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D' })[timeframe];
  }
  if (exchangeCode === 'bitget') {
    return ({ '1m': '1min', '5m': '5min', '15m': '15min', '1h': '1H', '4h': '4H', '1d': '1D' })[timeframe];
  }
  if (exchangeCode === 'okx') {
    return ({ '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D' })[timeframe];
  }
  return timeframe;
}

function normalizeProviderRows(exchangeCode, section, payload) {
  if (exchangeCode === 'binance') {
    if (section === 'candles') {
      return normalizeCandles(payload, (row) => ({
        timestamp: timestamp(row[0]),
        open: asNumber(row[1]),
        high: asNumber(row[2]),
        low: asNumber(row[3]),
        close: asNumber(row[4]),
        volume: asNumber(row[5]) ?? 0,
      }));
    }
    if (section === 'orderBook') return { bids: normalizeLevels(payload.bids), asks: normalizeLevels(payload.asks), timestamp: null };
    if (section === 'recentTrades') {
      return normalizeTrades(payload, (row) => ({
        price: asNumber(row.price),
        quantity: asNumber(row.qty),
        side: row.isBuyerMaker ? 'sell' : 'buy',
        timestamp: timestamp(row.time),
      }));
    }
    return payload;
  }

  if (exchangeCode === 'bybit') {
    if (section === 'candles') {
      return normalizeCandles(payload.result?.list, (row) => ({
        timestamp: timestamp(row[0]),
        open: asNumber(row[1]),
        high: asNumber(row[2]),
        low: asNumber(row[3]),
        close: asNumber(row[4]),
        volume: asNumber(row[5]) ?? 0,
      }));
    }
    if (section === 'orderBook') {
      const result = payload.result || {};
      return { bids: normalizeLevels(result.b), asks: normalizeLevels(result.a), timestamp: timestamp(payload.time) };
    }
    if (section === 'recentTrades') {
      return normalizeTrades(payload.result?.list, (row) => ({
        price: asNumber(row.price),
        quantity: asNumber(row.size),
        side: String(row.side || '').toLowerCase(),
        timestamp: timestamp(row.time),
      }));
    }
    return { ...(payload.result?.list?.[0] || {}), time: payload.time };
  }

  if (exchangeCode === 'bitget') {
    if (section === 'candles') {
      return normalizeCandles(payload.data, (row) => ({
        timestamp: timestamp(row[0]),
        open: asNumber(row[1]),
        high: asNumber(row[2]),
        low: asNumber(row[3]),
        close: asNumber(row[4]),
        volume: asNumber(row[5]) ?? 0,
      }));
    }
    if (section === 'orderBook') {
      const result = payload.data || {};
      return { bids: normalizeLevels(result.bids), asks: normalizeLevels(result.asks), timestamp: timestamp(result.ts) };
    }
    if (section === 'recentTrades') {
      return normalizeTrades(payload.data, (row) => ({
        price: asNumber(row.price),
        quantity: asNumber(row.size),
        side: String(row.side || '').toLowerCase(),
        timestamp: timestamp(row.ts),
      }));
    }
    return Array.isArray(payload.data) ? payload.data[0] || {} : payload.data || {};
  }

  if (exchangeCode === 'okx') {
    if (section === 'candles') {
      return normalizeCandles(payload.data, (row) => ({
        timestamp: timestamp(row[0]),
        open: asNumber(row[1]),
        high: asNumber(row[2]),
        low: asNumber(row[3]),
        close: asNumber(row[4]),
        volume: asNumber(row[5]) ?? 0,
      }));
    }
    if (section === 'orderBook') {
      const result = payload.data?.[0] || {};
      return { bids: normalizeLevels(result.bids), asks: normalizeLevels(result.asks), timestamp: timestamp(result.ts) };
    }
    if (section === 'recentTrades') {
      return normalizeTrades(payload.data, (row) => ({
        price: asNumber(row.px),
        quantity: asNumber(row.sz),
        side: String(row.side || '').toLowerCase(),
        timestamp: timestamp(row.ts),
      }));
    }
    return payload.data?.[0] || {};
  }

  return {};
}

function providerData(exchangeCode, { symbol, marketType, timeframe, limit }) {
  const config = EXCHANGES[exchangeCode];
  const derivative = marketType !== 'spot';
  const base = derivative ? config.futures : config.spot;
  const interval = timeframeFor(exchangeCode, timeframe);
  const query = (values) => new URLSearchParams(values).toString();

  if (exchangeCode === 'binance') {
    const prefix = derivative ? '/fapi/v1' : '/api/v3';
    const common = `symbol=${encodeURIComponent(symbol)}`;
    return {
      candles: [`${base}${prefix}/klines?${common}&interval=${interval}&limit=${limit}`, 'candles'],
      orderBook: [`${base}${prefix}/depth?${common}&limit=50`, 'orderBook'],
      recentTrades: [`${base}${prefix}/trades?${common}&limit=50`, 'recentTrades'],
      ticker: [`${base}${prefix}/ticker/24hr?${common}`, 'ticker'],
      metrics: derivative ? [
        [`${base}/fapi/v1/premiumIndex?${common}`, 'premium'],
        [`${base}/fapi/v1/openInterest?${common}`, 'openInterest'],
      ] : [],
    };
  }

  if (exchangeCode === 'bybit') {
    const category = derivative ? 'linear' : 'spot';
    const common = `category=${category}&symbol=${encodeURIComponent(symbol)}`;
    return {
      candles: [`${base}/v5/market/kline?${common}&interval=${interval}&limit=${limit}`, 'candles'],
      orderBook: [`${base}/v5/market/orderbook?${common}&limit=50`, 'orderBook'],
      recentTrades: [`${base}/v5/market/recent-trade?${common}&limit=50`, 'recentTrades'],
      ticker: [`${base}/v5/market/tickers?${common}`, 'ticker'],
      metrics: [],
    };
  }

  if (exchangeCode === 'bitget') {
    const productType = 'USDT-FUTURES';
    const common = `symbol=${encodeURIComponent(symbol)}`;
    return {
      candles: derivative
        ? [`${base}/api/v2/mix/market/candles?${common}&productType=${productType}&granularity=${interval}&limit=${limit}`, 'candles']
        : [`${base}/api/v2/spot/market/candles?${common}&granularity=${interval}&limit=${limit}`, 'candles'],
      orderBook: derivative
        ? [`${base}/api/v2/mix/market/merge-depth?${common}&productType=${productType}&limit=50`, 'orderBook']
        : [`${base}/api/v2/spot/market/orderbook?${common}&limit=50`, 'orderBook'],
      recentTrades: derivative
        ? [`${base}/api/v2/mix/market/fills?${common}&productType=${productType}&limit=50`, 'recentTrades']
        : [`${base}/api/v2/spot/market/fills?${common}&limit=50`, 'recentTrades'],
      ticker: derivative
        ? [`${base}/api/v2/mix/market/ticker?${query({ productType, symbol })}`, 'ticker']
        : [`${base}/api/v2/spot/market/tickers?${common}`, 'ticker'],
      metrics: [],
    };
  }

  if (exchangeCode === 'okx') {
    const instrumentType = derivative ? 'SWAP' : 'SPOT';
    const common = `instId=${encodeURIComponent(symbol)}`;
    return {
      candles: [`${base}/api/v5/market/candles?${common}&bar=${interval}&limit=${limit}`, 'candles'],
      orderBook: [`${base}/api/v5/market/books?${common}&sz=50`, 'orderBook'],
      recentTrades: [`${base}/api/v5/market/trades?${common}&limit=50`, 'recentTrades'],
      ticker: [`${base}/api/v5/market/ticker?${common}`, 'ticker'],
      metrics: derivative ? [
        [`${base}/api/v5/public/funding-rate?${common}`, 'funding'],
        [`${base}/api/v5/public/open-interest?${common}&instType=${instrumentType}`, 'openInterest'],
        [`${base}/api/v5/public/mark-price?${common}&instType=${instrumentType}`, 'mark'],
      ] : [],
    };
  }

  throw new ValidationError('Unsupported exchange');
}

function checkProviderResponse(exchangeCode, payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Empty provider response');
  if (exchangeCode === 'binance' && payload.code && payload.code < 0) throw new Error('Exchange rejected market-data request');
  if (exchangeCode === 'bybit' && payload.retCode !== undefined && payload.retCode !== 0) throw new Error('Exchange rejected market-data request');
  if (exchangeCode === 'bitget' && payload.code !== undefined && payload.code !== '00000') throw new Error('Exchange rejected market-data request');
  if (exchangeCode === 'okx' && payload.code !== undefined && payload.code !== '0') throw new Error('Exchange rejected market-data request');
  return payload;
}

function overviewFrom(exchangeCode, ticker, metrics, now) {
  const value = (key) => asNumber(ticker?.[key]);
  if (exchangeCode === 'binance') {
    const premium = metrics.premium || {};
    return {
      lastPrice: value('lastPrice'),
      markPrice: asNumber(premium.markPrice),
      indexPrice: asNumber(premium.indexPrice),
      fundingRate: asNumber(premium.lastFundingRate),
      openInterest: asNumber(metrics.openInterest?.openInterest),
      priceChangePercent: value('priceChangePercent'),
      high24h: value('highPrice'),
      low24h: value('lowPrice'),
      quoteVolume24h: value('quoteVolume'),
      timestamp: timestamp(ticker?.closeTime) || now,
    };
  }
  if (exchangeCode === 'bybit') {
    const sourceTime = timestamp(ticker?.time);
    return {
      lastPrice: value('lastPrice'),
      markPrice: value('markPrice'),
      indexPrice: value('indexPrice'),
      fundingRate: value('fundingRate'),
      openInterest: value('openInterest'),
      priceChangePercent: asNumber(ticker?.price24hPcnt) === null ? null : Number(ticker.price24hPcnt) * 100,
      high24h: value('highPrice24h'),
      low24h: value('lowPrice24h'),
      quoteVolume24h: value('turnover24h'),
      timestamp: sourceTime || now,
    };
  }
  if (exchangeCode === 'bitget') {
    return {
      lastPrice: value('lastPr') ?? value('last'),
      markPrice: value('markPrice'),
      indexPrice: value('indexPrice'),
      fundingRate: value('fundingRate'),
      openInterest: value('holdingAmount') ?? value('openInterest'),
      priceChangePercent: value('change24h') === null ? null : Number(ticker.change24h) * 100,
      high24h: value('high24h'),
      low24h: value('low24h'),
      quoteVolume24h: value('quoteVolume') ?? value('usdtVolume'),
      timestamp: timestamp(ticker?.ts) || now,
    };
  }
  return {
    lastPrice: value('last'),
    markPrice: asNumber(metrics.mark?.markPx),
    indexPrice: value('idxPx'),
    fundingRate: asNumber(metrics.funding?.fundingRate),
    openInterest: asNumber(metrics.openInterest?.oi),
    priceChangePercent: value('change24h'),
    high24h: value('high24h'),
    low24h: value('low24h'),
    quoteVolume24h: value('volCcy24h'),
    timestamp: timestamp(ticker?.ts) || now,
  };
}

export function createMarketDataService({ logger, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const cache = new Map();
  const priceCache = new Map();

  async function request(url, exchangeCode) {
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return checkProviderResponse(exchangeCode, await response.json());
  }

  async function getSpotPrice({ exchangeCode, symbol }) {
    const exchange = String(exchangeCode || '').toLowerCase();
    const normalizedSymbol = String(symbol || '').trim().toUpperCase();
    if (!EXCHANGES[exchange]) throw new ValidationError('Unsupported exchange');
    if (!/^[A-Z0-9._-]{3,48}$/.test(normalizedSymbol)) throw new ValidationError('Invalid exchange symbol');

    const key = `${exchange}:${normalizedSymbol}`;
    const cached = priceCache.get(key);
    if (cached && now() - cached.cachedAt < PRICE_CACHE_TTL_MS) return cached.price;

    const endpoint = providerData(exchange, {
      symbol: normalizedSymbol,
      marketType: 'spot',
      timeframe: '1h',
      limit: 25,
    }).ticker;
    const ticker = normalizeProviderRows(exchange, endpoint[1], await request(endpoint[0], exchange));
    const price = overviewFrom(exchange, ticker, {}, now()).lastPrice;
    if (!Number.isFinite(price) || price <= 0) {
      throw new AppError(`No valid spot price is available for ${normalizedSymbol}`, {
        code: 'MARKET_PRICE_UNAVAILABLE',
        status: 503,
        expose: true,
      });
    }

    priceCache.set(key, { cachedAt: now(), price });
    if (priceCache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = priceCache.keys().next().value;
      if (oldestKey) priceCache.delete(oldestKey);
    }
    return price;
  }

  async function getMarketData({ exchangeCode, symbol, marketType = 'spot', timeframe = '1h', limit = 120 }) {
    const exchange = String(exchangeCode || '').toLowerCase();
    const normalizedSymbol = String(symbol || '').trim().toUpperCase();
    const normalizedMarketType = marketType === 'spot' ? 'spot' : 'futures';
    const normalizedTimeframe = String(timeframe || '1h').toLowerCase();
    const config = EXCHANGES[exchange];

    if (!config) throw new ValidationError('Unsupported exchange');
    if (!/^[A-Z0-9._-]{3,48}$/.test(normalizedSymbol)) throw new ValidationError('Invalid exchange symbol');
    if (!config.timeframes.includes(normalizedTimeframe)) throw new ValidationError('Unsupported candle timeframe');
    const safeLimit = Math.max(25, Math.min(300, Number(limit) || 120));
    const key = `${exchange}:${normalizedMarketType}:${normalizedSymbol}:${normalizedTimeframe}:${safeLimit}`;
    const cached = cache.get(key);
    if (cached && now() - cached.cachedAt < CACHE_TTL_MS) {
      return { ...cached.value, cacheAgeMs: now() - cached.cachedAt };
    }

    const endpoints = providerData(exchange, {
      symbol: normalizedSymbol,
      marketType: normalizedMarketType,
      timeframe: normalizedTimeframe,
      limit: safeLimit,
    });
    const requests = [
      ['candles', endpoints.candles],
      ['orderBook', endpoints.orderBook],
      ['recentTrades', endpoints.recentTrades],
      ['ticker', endpoints.ticker],
      ...endpoints.metrics.map(([url, name]) => [name, [url, name]]),
    ];
    const settled = await Promise.allSettled(
      requests.map(async ([name, [url, section]]) => ({
        name,
        payload: normalizeProviderRows(exchange, section, await request(url, exchange)),
      }))
    );
    const sections = {};
    for (let index = 0; index < requests.length; index += 1) {
      const name = requests[index][0];
      const result = settled[index];
      sections[name] = result.status === 'fulfilled'
        ? { status: 'available' }
        : { status: 'unavailable', error: 'Exchange data is temporarily unavailable' };
    }
    const available = settled
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
    if (available.length === 0) {
      logger?.warn?.({ exchangeCode: exchange, symbol: normalizedSymbol }, 'All market-data sections failed');
      throw new AppError('Exchange market data is temporarily unavailable', {
        code: 'MARKET_DATA_UNAVAILABLE',
        status: 503,
        expose: true,
      });
    }
    const payloads = Object.fromEntries(available.map((item) => [item.name, item.payload]));
    const receivedAt = now();
    const sourceTimestamp = timestamp(payloads.ticker?.timestamp) ||
      timestamp(payloads.recentTrades?.[0]?.timestamp) ||
      timestamp(payloads.candles?.at(-1)?.timestamp);
    const result = normalizeMarketDataPayload(exchange, {
      symbol: normalizedSymbol,
      marketType: normalizedMarketType,
      timeframe: normalizedTimeframe,
      candles: payloads.candles,
      orderBook: payloads.orderBook,
      recentTrades: payloads.recentTrades,
      overview: overviewFrom(exchange, payloads.ticker, {
        premium: payloads.premium,
        openInterest: payloads.openInterest,
        funding: payloads.funding,
        mark: payloads.mark,
      }, receivedAt),
      sourceTimestamp,
      sections,
    }, { now: receivedAt });

    cache.set(key, { cachedAt: receivedAt, value: result });
    if (cache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    return { ...result, cacheAgeMs: 0 };
  }

  return { getMarketData, getSpotPrice };
}

export default createMarketDataService;
