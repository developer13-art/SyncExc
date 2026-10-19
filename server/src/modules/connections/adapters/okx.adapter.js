/**
 * SyncExc Server — OKX adapter
 */

import crypto from 'node:crypto';
import { createBaseAdapter } from './base.adapter.js';

const BASE_URL = 'https://www.okx.com';

export function createOkxAdapter({ config, logger }) {
  const base = createBaseAdapter({
    exchangeCode: 'okx',
    restBaseUrl: BASE_URL,
    config,
    logger,
  });

  function signedHeaders({ apiKey, apiSecret, passphrase, method, requestPath, body, environment }) {
    const timestamp = new Date().toISOString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const preSign = `${timestamp}${method}${requestPath}${bodyStr}`;
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(preSign)
      .digest('base64');
    return {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json',
      ...(environment === 'demo' ? { 'x-simulated-trading': '1' } : {}),
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
      supportedOrderTypes: ['market', 'limit', 'post_only', 'fok', 'ioc'],
      supportedTimeInForce: ['GTC', 'IOC', 'FOK', 'PostOnly'],
    },

    async validateCredentials({ apiKey, apiSecret, passphrase, environment }) {
      const path = '/api/v5/account/balance?ccy=USDT';
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

      if (data.code !== '0') throw new Error(`OKX auth error: ${data.msg}`);

      return {
        accountType: 'unified',
        permissions: [],
        canRead: true,
        canTrade: true,
        canWithdraw: false,
      };
    },

    async discoverAccounts() {
      return [
        { exchangeAccountId: 'unified', accountType: 'unified', status: 'active' },
        { exchangeAccountId: 'spot', accountType: 'spot', status: 'active' },
      ];
    },

    async fetchBalances({ apiKey, apiSecret, passphrase, environment }) {
      const path = '/api/v5/account/balance';
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

      if (data.code !== '0') throw new Error(`OKX balance error: ${data.msg}`);

      const details = data.data?.[0]?.details || [];
      return details.map((d) => ({
        asset: d.ccy,
        free: d.availBal || d.availEq || '0',
        used: d.frozenBal || '0',
        total: d.eq || '0',
      }));
    },

    async fetchInstruments({ marketType = 'spot' }) {
      const instType = marketType === 'spot' ? 'SPOT' : 'SWAP';
      const res = await fetch(`${BASE_URL}/api/v5/public/instruments?instType=${instType}`);
      const data = await res.json();
      if (data.code !== '0') throw new Error(`OKX instrument error: ${data.msg}`);

      return (data.data || []).map((s) => ({
        exchangeSymbol: s.instId,
        normalizedSymbol: s.instId,
        marketType,
        baseAsset: s.baseCcy,
        quoteAsset: s.quoteCcy || s.settleCcy,
        settlementAsset: s.settleCcy,
        tickSize: s.tickSz,
        quantityStep: s.lotSz,
        minimumQuantity: s.minSz || null,
        minimumNotional: null,
        contractMultiplier: s.ctVal || '1',
        tradingStatus: s.state === 'live' ? 'active' : 'suspended',
      }));
    },

    async placeOrder({ apiKey, apiSecret, passphrase, environment, order }) {
      const path = '/api/v5/trade/order';
      const body = {
        instId: order.instrument,
        tdMode: order.marketType === 'spot' ? 'cash' : 'cross',
        side: order.side,
        ordType: order.type,
        sz: order.quantity,
      };
      if (order.price) body.px = order.price;
      if (order.clientOrderId) body.clOrdId = order.clientOrderId;
      if (order.reduceOnly) body.reduceOnly = true;

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

      if (data.code !== '0') throw new Error(`OKX order error: ${data.msg}`);

      return {
        exchangeOrderId: data.data?.[0]?.ordId,
        clientOrderId: data.data?.[0]?.clOrdId,
        status: 'submitted',
      };
    },

    async cancelOrder({ apiKey, apiSecret, passphrase, environment, instrument, exchangeOrderId }) {
      const path = '/api/v5/trade/cancel-order';
      const body = { instId: instrument, ordId: exchangeOrderId };
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
      if (data.code !== '0') throw new Error(`OKX cancel error: ${data.msg}`);
      return { status: 'canceled' };
    },

    async fetchOrder({ apiKey, apiSecret, passphrase, environment, instrument, exchangeOrderId }) {
      const query = new URLSearchParams({ instId: instrument, ordId: exchangeOrderId }).toString();
      const path = `/api/v5/trade/order?${query}`;
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
      if (data.code !== '0') throw new Error(`OKX order fetch error: ${data.msg}`);

      const order = data.data?.[0];
      if (!order) return null;

      return {
        exchangeOrderId: order.ordId,
        status: this._mapStatus(order.state),
        filledQuantity: order.accFillSz,
        remainingQuantity: null,
        averageFillPrice: order.avgPx,
      };
    },

    async fetchOpenOrders({ apiKey, apiSecret, passphrase, environment, instrument }) {
      const query = instrument ? `instId=${instrument}` : '';
      const path = `/api/v5/trade/orders-pending${query ? `?${query}` : ''}`;
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
      if (data.code !== '0') throw new Error(`OKX open orders error: ${data.msg}`);

      return (data.data || []).map((o) => ({
        exchangeOrderId: o.ordId,
        instrument: o.instId,
        side: o.side,
        type: o.ordType,
        quantity: o.sz,
        filledQuantity: o.accFillSz,
        price: o.px,
        status: this._mapStatus(o.state),
      }));
    },

    async fetchPositions({ apiKey, apiSecret, passphrase, environment }) {
      const path = '/api/v5/account/positions';
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
      if (data.code !== '0') throw new Error(`OKX positions error: ${data.msg}`);

      return (data.data || [])
        .filter((p) => Number(p.pos) !== 0)
        .map((p) => ({
          instrument: p.instId,
          side: p.posSide === 'long' || Number(p.pos) > 0 ? 'long' : 'short',
          quantity: String(Math.abs(Number(p.pos))),
          entryPrice: p.avgPx,
          markPrice: p.markPx,
          unrealizedPnl: p.upl,
          leverage: p.lever,
          liquidationPrice: p.liqPx,
        }));
    },

    _mapStatus(status) {
      const map = {
        live: 'submitted',
        partially_filled: 'partially_filled',
        filled: 'filled',
        canceled: 'canceled',
        mmp_canceled: 'canceled',
      };
      return map[status] || 'unknown';
    },
  };
}

export default createOkxAdapter;