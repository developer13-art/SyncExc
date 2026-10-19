/**
 * SyncExc Server — Bitget adapter
 */

import crypto from 'node:crypto';
import { createBaseAdapter } from './base.adapter.js';

const BASE_URL = 'https://api.bitget.com';

export function createBitgetAdapter({ config, logger }) {
  const base = createBaseAdapter({
    exchangeCode: 'bitget',
    restBaseUrl: BASE_URL,
    config,
    logger,
  });

  function signedHeaders({ apiKey, apiSecret, passphrase, method, requestPath, body, environment }) {
    const timestamp = Date.now().toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const preSign = `${timestamp}${method}${requestPath}${bodyStr}`;
    const signature = crypto.createHmac('sha256', apiSecret).update(preSign).digest('base64');
    return {
      'ACCESS-KEY': apiKey,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json',
      ...(environment === 'demo' ? { paptrading: '1' } : {}),
    };
  }

  return {
    ...base,

    capabilities: {
      hasSpot: true,
      hasFutures: true,
      hasMargin: true,
      hasSubaccounts: true,
      hasWebsocket: true,
      supportedOrderTypes: ['market', 'limit'],
      supportedTimeInForce: ['GTC', 'IOC', 'FOK', 'PostOnly'],
    },

    async validateCredentials({ apiKey, apiSecret, passphrase, environment }) {
      const path = '/api/v2/spot/account/assets';
      const headers = signedHeaders({
        apiKey,
        apiSecret,
        passphrase,
        method: 'GET',
        requestPath: path,
        body: null,
        environment,
      });
      const data = await this.fetchSigned({
        url: `${BASE_URL}${path}`,
        method: 'GET',
        headers,
      });

      if (data.code !== '00000') throw new Error(`Bitget auth error: ${data.msg}`);

      return {
        accountType: 'spot',
        permissions: [],
        canRead: true,
        canTrade: true,
        canWithdraw: false,
      };
    },

    async discoverAccounts() {
      return [
        { exchangeAccountId: 'spot', accountType: 'spot', status: 'active' },
        { exchangeAccountId: 'futures', accountType: 'usd_m_futures', status: 'active' },
      ];
    },

    async fetchBalances({ apiKey, apiSecret, passphrase, accountType = 'spot', environment }) {
      const path = accountType === 'spot' ? '/api/v2/spot/account/assets' : '/api/v2/mix/account/accounts';
      const headers = signedHeaders({
        apiKey,
        apiSecret,
        passphrase,
        method: 'GET',
        requestPath: path,
        body: null,
        environment,
      });
      const data = await this.fetchSigned({
        url: `${BASE_URL}${path}`,
        method: 'GET',
        headers,
      });

      if (data.code !== '00000') throw new Error(`Bitget balance error: ${data.msg}`);

      const assets = data.data || [];
      return assets.map((a) => ({
        asset: a.coin || a.marginCoin,
        free: a.available,
        used: a.locked || a.frozen || '0',
        total: a.available + (a.locked || '0'),
      }));
    },

    async fetchInstruments({ marketType = 'spot' }) {
      const url =
        marketType === 'spot'
          ? `${BASE_URL}/api/v2/spot/public/symbols`
          : `${BASE_URL}/api/v2/mix/market/contracts?productType=USDT-FUTURES`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== '00000') throw new Error(`Bitget instrument error: ${data.msg}`);

      return (data.data || []).map((s) => ({
        exchangeSymbol: s.symbol,
        normalizedSymbol: s.symbol,
        marketType,
        baseAsset: s.baseCoin,
        quoteAsset: s.quoteCoin,
        settlementAsset: s.quoteCoin,
        tickSize: s.pricePrecision || '0.01',
        quantityStep: s.quantityPrecision || '0.001',
        minimumQuantity: s.minTradeNum || null,
        minimumNotional: s.minTradeUSDT || null,
        contractMultiplier: '1',
        tradingStatus: s.status === 'online' ? 'active' : 'suspended',
      }));
    },

    async placeOrder({ apiKey, apiSecret, passphrase, accountType = 'spot', environment, order }) {
      const path =
        accountType === 'spot' ? '/api/v2/spot/trade/place-order' : '/api/v2/mix/order/place-order';
      const body = {
        symbol: order.instrument,
        side: order.side,
        orderType: order.type,
        force: order.timeInForce || 'gtc',
        size: order.quantity,
      };
      if (order.price) body.price = order.price;
      if (order.clientOrderId) body.clientOid = order.clientOrderId;

      const headers = signedHeaders({
        apiKey,
        apiSecret,
        passphrase,
        method: 'POST',
        requestPath: path,
        body,
        environment,
      });
      const data = await this.fetchSigned({
        url: `${BASE_URL}${path}`,
        method: 'POST',
        headers,
        body,
      });

      if (data.code !== '00000') throw new Error(`Bitget order error: ${data.msg}`);

      return {
        exchangeOrderId: data.data.orderId,
        clientOrderId: data.data.clientOid,
        status: 'submitted',
      };
    },

    async cancelOrder({
      apiKey,
      apiSecret,
      passphrase,
      accountType = 'spot',
      environment,
      instrument,
      exchangeOrderId,
    }) {
      const path =
        accountType === 'spot' ? '/api/v2/spot/trade/cancel-order' : '/api/v2/mix/order/cancel-order';
      const body = { symbol: instrument, orderId: exchangeOrderId };
      const headers = signedHeaders({
        apiKey,
        apiSecret,
        passphrase,
        method: 'POST',
        requestPath: path,
        body,
        environment,
      });
      const data = await this.fetchSigned({
        url: `${BASE_URL}${path}`,
        method: 'POST',
        headers,
        body,
      });
      if (data.code !== '00000') throw new Error(`Bitget cancel error: ${data.msg}`);
      return { status: 'canceled' };
    },

    async fetchOrder({
      apiKey,
      apiSecret,
      passphrase,
      accountType = 'spot',
      environment,
      instrument,
      exchangeOrderId,
    }) {
      const path =
        accountType === 'spot' ? '/api/v2/spot/trade/orderInfo' : '/api/v2/mix/order/detail';
      const query = new URLSearchParams({ symbol: instrument, orderId: exchangeOrderId }).toString();
      const fullPath = `${path}?${query}`;
      const headers = signedHeaders({
        apiKey,
        apiSecret,
        passphrase,
        method: 'GET',
        requestPath: fullPath,
        body: null,
        environment,
      });
      const data = await this.fetchSigned({
        url: `${BASE_URL}${fullPath}`,
        method: 'GET',
        headers,
      });
      if (data.code !== '00000') throw new Error(`Bitget order fetch error: ${data.msg}`);
      const order = data.data?.[0] || data.data;
      if (!order) return null;
      return {
        exchangeOrderId: order.orderId,
        status: this._mapStatus(order.status),
        filledQuantity: order.baseVolume || order.fillSize || '0',
        remainingQuantity: order.quoteVolume || null,
        averageFillPrice: order.priceAvg || null,
      };
    },

    async fetchOpenOrders({
      apiKey,
      apiSecret,
      passphrase,
      accountType = 'spot',
      environment,
      instrument,
    }) {
      const path =
        accountType === 'spot' ? '/api/v2/spot/trade/unfilled-orders' : '/api/v2/mix/order/orders-pending';
      const params = instrument ? { symbol: instrument } : {};
      const query = new URLSearchParams(params).toString();
      const fullPath = query ? `${path}?${query}` : path;
      const headers = signedHeaders({
        apiKey,
        apiSecret,
        passphrase,
        method: 'GET',
        requestPath: fullPath,
        body: null,
        environment,
      });
      const data = await this.fetchSigned({
        url: `${BASE_URL}${fullPath}`,
        method: 'GET',
        headers,
      });
      if (data.code !== '00000') throw new Error(`Bitget open orders error: ${data.msg}`);

      return (data.data || []).map((o) => ({
        exchangeOrderId: o.orderId,
        instrument: o.symbol,
        side: o.side,
        type: o.orderType,
        quantity: o.size,
        filledQuantity: o.baseVolume || '0',
        price: o.price,
        status: this._mapStatus(o.status),
      }));
    },

    async fetchPositions({ apiKey, apiSecret, passphrase, environment }) {
      const path = '/api/v2/mix/position/all-position?productType=USDT-FUTURES&marginCoin=USDT';
      const headers = signedHeaders({
        apiKey,
        apiSecret,
        passphrase,
        method: 'GET',
        requestPath: path,
        body: null,
        environment,
      });
      const data = await this.fetchSigned({
        url: `${BASE_URL}${path}`,
        method: 'GET',
        headers,
      });
      if (data.code !== '00000') throw new Error(`Bitget positions error: ${data.msg}`);

      return (data.data || [])
        .filter((p) => Number(p.total) > 0)
        .map((p) => ({
          instrument: p.symbol,
          side: p.holdSide === 'long' ? 'long' : 'short',
          quantity: p.total,
          entryPrice: p.openPriceAvg,
          markPrice: p.markPrice,
          unrealizedPnl: p.unrealizedPL,
          leverage: p.leverage,
          liquidationPrice: p.liquidationPrice,
        }));
    },

    _mapStatus(status) {
      const map = {
        new: 'submitted',
        partially_filled: 'partially_filled',
        filled: 'filled',
        canceled: 'canceled',
        rejected: 'rejected',
        expired: 'expired',
      };
      return map[status] || 'unknown';
    },
  };
}

export default createBitgetAdapter;