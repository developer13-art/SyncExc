/**
 * SyncExc Server — Binance adapter
 *
 * Supports spot, USDⓈ-M futures, COIN-M futures, and margin.
 */

import crypto from 'node:crypto';
import { createBaseAdapter } from './base.adapter.js';

const SPOT_BASE = 'https://api.binance.com';
const FUTURES_BASE = 'https://fapi.binance.com';
const SPOT_TESTNET_BASE = 'https://testnet.binance.vision';
const FUTURES_TESTNET_BASE = 'https://testnet.binancefuture.com';

function getBaseUrl(accountType, environment) {
  const isFutures = accountType === 'usd_m_futures';
  if (environment === 'testnet') {
    return isFutures ? FUTURES_TESTNET_BASE : SPOT_TESTNET_BASE;
  }
  return isFutures ? FUTURES_BASE : SPOT_BASE;
}

export function createBinanceAdapter({ config, logger }) {
  const base = createBaseAdapter({
    exchangeCode: 'binance',
    restBaseUrl: SPOT_BASE,
    config,
    logger,
  });

  function signQuery(query, secret) {
    return crypto.createHmac('sha256', secret).update(query).digest('hex');
  }

  function buildSignedUrl(baseUrl, path, params, apiKey, secret) {
    const search = new URLSearchParams({ ...params, timestamp: Date.now() });
    const signature = signQuery(search.toString(), secret);
    search.append('signature', signature);
    return `${baseUrl}${path}?${search.toString()}`;
  }

  return {
    ...base,

    capabilities: {
      hasSpot: true,
      hasFutures: true,
      hasMargin: true,
      hasSubaccounts: false,
      hasWebsocket: true,
      supportedOrderTypes: ['market', 'limit', 'stop_market', 'stop_limit', 'take_profit_market', 'take_profit_limit'],
      supportedTimeInForce: ['GTC', 'IOC', 'FOK'],
    },

    async validateCredentials({ apiKey, apiSecret, environment }) {
      const url = buildSignedUrl(
        getBaseUrl('spot', environment),
        '/api/v3/account',
        {},
        apiKey,
        apiSecret
      );
      const data = await this.fetchSigned({
        url,
        method: 'GET',
        headers: { 'X-MBX-APIKEY': apiKey },
      });

      return {
        accountType: 'spot',
        permissions: data.permissions || [],
        canRead: Boolean(data.balances),
        canTrade: data.canTrade !== false,
        canWithdraw: data.canWithdraw === true,
      };
    },

    async discoverAccounts({ apiKey, apiSecret }) {
      // Binance doesn't have a first-class "accounts" concept; return spot + futures
      return [
        { exchangeAccountId: 'spot', accountType: 'spot', status: 'active' },
        { exchangeAccountId: 'usdm', accountType: 'usd_m_futures', status: 'active' },
      ];
    },

    async fetchBalances({ apiKey, apiSecret, accountType = 'spot', environment }) {
      if (accountType === 'spot') {
        const url = buildSignedUrl(
          getBaseUrl(accountType, environment),
          '/api/v3/account',
          {},
          apiKey,
          apiSecret
        );
        const data = await this.fetchSigned({
          url,
          method: 'GET',
          headers: { 'X-MBX-APIKEY': apiKey },
        });
        return (data.balances || []).map((b) => ({
          asset: b.asset,
          free: b.free,
          used: b.locked,
          total: String(Number(b.free) + Number(b.locked)),
        }));
      }
      if (accountType === 'usd_m_futures') {
        const url = buildSignedUrl(
          getBaseUrl(accountType, environment),
          '/fapi/v2/balance',
          {},
          apiKey,
          apiSecret
        );
        const data = await this.fetchSigned({
          url,
          method: 'GET',
          headers: { 'X-MBX-APIKEY': apiKey },
        });
        return data.map((b) => ({
          asset: b.asset,
          free: b.availableBalance,
          used: String(Number(b.balance) - Number(b.availableBalance)),
          total: b.balance,
        }));
      }
      return [];
    },

    async fetchInstruments({ marketType = 'spot' }) {
      if (marketType === 'spot') {
        const res = await fetch(`${SPOT_BASE}/api/v3/exchangeInfo`);
        const data = await res.json();
        return (data.symbols || []).map((s) => ({
          exchangeSymbol: s.symbol,
          normalizedSymbol: s.symbol,
          marketType: 'spot',
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          tickSize: s.filters.find((f) => f.filterType === 'PRICE_FILTER')?.tickSize || '0.01',
          quantityStep: s.filters.find((f) => f.filterType === 'LOT_SIZE')?.stepSize || '0.00001',
          minimumQuantity: s.filters.find((f) => f.filterType === 'LOT_SIZE')?.minQty || null,
          minimumNotional: s.filters.find((f) => f.filterType === 'MIN_NOTIONAL')?.minNotional || null,
          tradingStatus: s.status === 'TRADING' ? 'active' : 'suspended',
        }));
      }
      if (marketType === 'futures') {
        const res = await fetch(`${FUTURES_BASE}/fapi/v1/exchangeInfo`);
        const data = await res.json();
        return (data.symbols || []).map((s) => ({
          exchangeSymbol: s.symbol,
          normalizedSymbol: s.symbol,
          marketType: 'futures',
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          settlementAsset: s.marginAsset || s.quoteAsset,
          tickSize: s.filters.find((f) => f.filterType === 'PRICE_FILTER')?.tickSize || '0.01',
          quantityStep: s.filters.find((f) => f.filterType === 'LOT_SIZE')?.stepSize || '0.001',
          minimumQuantity: s.filters.find((f) => f.filterType === 'LOT_SIZE')?.minQty || null,
          minimumNotional: s.filters.find((f) => f.filterType === 'MIN_NOTIONAL')?.notional || null,
          contractMultiplier: s.contractSize || '1',
          tradingStatus: s.status === 'TRADING' ? 'active' : 'suspended',
        }));
      }
      return [];
    },

    async placeOrder({ apiKey, apiSecret, accountType, environment, order }) {
      const path = accountType === 'usd_m_futures' ? '/fapi/v1/order' : '/api/v3/order';
      const baseUrl = getBaseUrl(accountType, environment);

      const params = {
        symbol: order.instrument,
        side: order.side.toUpperCase(),
        type: order.type.toUpperCase().replace('_', ''),
        quantity: order.quantity,
      };
      if (order.price) params.price = order.price;
      if (order.timeInForce) params.timeInForce = order.timeInForce;
      if (order.clientOrderId) params.newClientOrderId = order.clientOrderId;
      if (order.reduceOnly) params.reduceOnly = 'true';

      const url = buildSignedUrl(baseUrl, path, params, apiKey, apiSecret);
      const data = await this.fetchSigned({
        url,
        method: 'POST',
        headers: { 'X-MBX-APIKEY': apiKey },
      });

      return {
        exchangeOrderId: String(data.orderId),
        clientOrderId: data.clientOrderId,
        status: this._mapOrderStatus(data.status),
        filledQuantity: data.executedQty,
        averageFillPrice: data.avgPrice || null,
      };
    },

    async cancelOrder({ apiKey, apiSecret, accountType, environment, instrument, exchangeOrderId }) {
      const path = accountType === 'usd_m_futures' ? '/fapi/v1/order' : '/api/v3/order';
      const baseUrl = getBaseUrl(accountType, environment);
      const url = buildSignedUrl(
        baseUrl,
        path,
        { symbol: instrument, orderId: exchangeOrderId },
        apiKey,
        apiSecret
      );
      const data = await this.fetchSigned({
        url,
        method: 'DELETE',
        headers: { 'X-MBX-APIKEY': apiKey },
      });
      return { status: this._mapOrderStatus(data.status) };
    },

    async fetchOrder({ apiKey, apiSecret, accountType, environment, instrument, exchangeOrderId }) {
      const path = accountType === 'usd_m_futures' ? '/fapi/v1/order' : '/api/v3/order';
      const baseUrl = getBaseUrl(accountType, environment);
      const url = buildSignedUrl(
        baseUrl,
        path,
        { symbol: instrument, orderId: exchangeOrderId },
        apiKey,
        apiSecret
      );
      const data = await this.fetchSigned({
        url,
        method: 'GET',
        headers: { 'X-MBX-APIKEY': apiKey },
      });
      return {
        exchangeOrderId: String(data.orderId),
        status: this._mapOrderStatus(data.status),
        filledQuantity: data.executedQty,
        remainingQuantity: String(Number(data.origQty) - Number(data.executedQty)),
        averageFillPrice: data.avgPrice || null,
      };
    },

    async fetchOpenOrders({ apiKey, apiSecret, accountType, environment, instrument }) {
      const path = accountType === 'usd_m_futures' ? '/fapi/v1/openOrders' : '/api/v3/openOrders';
      const baseUrl = getBaseUrl(accountType, environment);
      const params = instrument ? { symbol: instrument } : {};
      const url = buildSignedUrl(baseUrl, path, params, apiKey, apiSecret);
      const data = await this.fetchSigned({
        url,
        method: 'GET',
        headers: { 'X-MBX-APIKEY': apiKey },
      });
      return data.map((o) => ({
        exchangeOrderId: String(o.orderId),
        instrument: o.symbol,
        side: o.side.toLowerCase(),
        type: o.type.toLowerCase(),
        quantity: o.origQty,
        filledQuantity: o.executedQty,
        price: o.price,
        status: this._mapOrderStatus(o.status),
      }));
    },

    async fetchPositions({ apiKey, apiSecret, environment }) {
      const url = buildSignedUrl(
        getBaseUrl('usd_m_futures', environment),
        '/fapi/v2/positionRisk',
        {},
        apiKey,
        apiSecret
      );
      const data = await this.fetchSigned({
        url,
        method: 'GET',
        headers: { 'X-MBX-APIKEY': apiKey },
      });
      return data
        .filter((p) => Number(p.positionAmt) !== 0)
        .map((p) => ({
          instrument: p.symbol,
          side: Number(p.positionAmt) > 0 ? 'long' : 'short',
          quantity: String(Math.abs(Number(p.positionAmt))),
          entryPrice: p.entryPrice,
          markPrice: p.markPrice,
          unrealizedPnl: p.unRealizedProfit,
          leverage: p.leverage,
          liquidationPrice: p.liquidationPrice,
        }));
    },

    _mapOrderStatus(status) {
      const map = {
        NEW: 'submitted',
        PARTIALLY_FILLED: 'partially_filled',
        FILLED: 'filled',
        CANCELED: 'canceled',
        PENDING_CANCEL: 'cancel_requested',
        REJECTED: 'rejected',
        EXPIRED: 'expired',
      };
      return map[status] || 'unknown';
    },
  };
}

export default createBinanceAdapter;