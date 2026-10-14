/**
 * SyncExc Server — Bybit adapter
 */

import crypto from 'node:crypto';
import { createBaseAdapter } from './base.adapter.js';

const BASE_URL = 'https://api.bybit.com';

export function createBybitAdapter({ config, logger }) {
  const base = createBaseAdapter({
    exchangeCode: 'bybit',
    restBaseUrl: BASE_URL,
    config,
    logger,
  });

  function signRequest({ apiKey, apiSecret, params, timestamp, recvWindow = 5000 }) {
    const paramStr = typeof params === 'string' ? params : JSON.stringify(params || {});
    const payload = `${timestamp}${apiKey}${recvWindow}${paramStr}`;
    return crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
  }

  function signedHeaders({ apiKey, apiSecret, params }) {
    const timestamp = Date.now();
    const signature = signRequest({ apiKey, apiSecret, params, timestamp });
    return {
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-TIMESTAMP': String(timestamp),
      'X-BAPI-SIGN': signature,
      'X-BAPI-RECV-WINDOW': '5000',
      'Content-Type': 'application/json',
    };
  }

  return {
    ...base,

    capabilities: {
      hasSpot: true,
      hasFutures: true,
      hasMargin: false,
      hasSubaccounts: true,
      hasWebsocket: true,
      supportedOrderTypes: ['market', 'limit'],
      supportedTimeInForce: ['GTC', 'IOC', 'FOK', 'PostOnly'],
    },

    async validateCredentials({ apiKey, apiSecret }) {
      const path = '/v5/user/query-api';
      const headers = signedHeaders({ apiKey, apiSecret, params: {} });
      const data = await this.fetchSigned({
        url: `${BASE_URL}${path}`,
        method: 'GET',
        headers,
      });

      if (data.retCode !== 0) throw new Error(`Bybit auth error: ${data.retMsg}`);

      return {
        accountType: 'unified',
        permissions: data.result?.permissions || {},
        canRead: true,
        canTrade: Boolean(data.result?.permissions?.ContractTrade || data.result?.permissions?.Spot),
        canWithdraw: Boolean(data.result?.permissions?.Withdraw),
      };
    },

    async discoverAccounts() {
      return [
        { exchangeAccountId: 'unified', accountType: 'unified', status: 'active' },
      ];
    },

    async fetchBalances({ apiKey, apiSecret, accountType = 'unified' }) {
      const path = '/v5/account/wallet-balance';
      const params = { accountType: accountType === 'unified' ? 'UNIFIED' : 'SPOT' };
      const headers = signedHeaders({ apiKey, apiSecret, params });
      const query = new URLSearchParams(params).toString();
      const data = await this.fetchSigned({
        url: `${BASE_URL}${path}?${query}`,
        method: 'GET',
        headers,
      });

      if (data.retCode !== 0) throw new Error(`Bybit balance error: ${data.retMsg}`);

      const coins = data.result?.list?.[0]?.coin || [];
      return coins.map((c) => ({
        asset: c.coin,
        free: c.availableToWithdraw || c.walletBalance,
        used: c.locked || '0',
        total: c.walletBalance,
      }));
    },

    async fetchInstruments({ marketType = 'spot' }) {
      const category = marketType === 'spot' ? 'spot' : 'linear';
      const res = await fetch(`${BASE_URL}/v5/market/instruments-info?category=${category}`);
      const data = await res.json();
      if (data.retCode !== 0) throw new Error(`Bybit instrument error: ${data.retMsg}`);

      return (data.result?.list || []).map((s) => ({
        exchangeSymbol: s.symbol,
        normalizedSymbol: s.symbol,
        marketType,
        baseAsset: s.baseCoin,
        quoteAsset: s.quoteCoin,
        settlementAsset: s.settleCoin || s.quoteCoin,
        tickSize: s.priceFilter?.tickSize || '0.01',
        quantityStep: s.lotSizeFilter?.qtyStep || '0.001',
        minimumQuantity: s.lotSizeFilter?.minOrderQty || null,
        minimumNotional: s.lotSizeFilter?.minOrderAmt || null,
        contractMultiplier: s.contractSize || '1',
        tradingStatus: s.status === 'Trading' ? 'active' : 'suspended',
      }));
    },

    async placeOrder({ apiKey, apiSecret, accountType = 'unified', order }) {
      const path = '/v5/order/create';
      const body = {
        category: order.marketType === 'spot' ? 'spot' : 'linear',
        symbol: order.instrument,
        side: order.side === 'buy' ? 'Buy' : 'Sell',
        orderType: order.type === 'market' ? 'Market' : 'Limit',
        qty: order.quantity,
      };
      if (order.price) body.price = order.price;
      if (order.clientOrderId) body.orderLinkId = order.clientOrderId;
      if (order.reduceOnly) body.reduceOnly = true;
      if (order.timeInForce) body.timeInForce = order.timeInForce;

      const headers = signedHeaders({ apiKey, apiSecret, params: body });
      const data = await this.fetchSigned({
        url: `${BASE_URL}${path}`,
        method: 'POST',
        headers,
        body,
      });

      if (data.retCode !== 0) throw new Error(`Bybit order error: ${data.retMsg}`);

      return {
        exchangeOrderId: data.result.orderId,
        clientOrderId: data.result.orderLinkId,
        status: 'submitted',
      };
    },

    async cancelOrder({ apiKey, apiSecret, accountType = 'unified', instrument, exchangeOrderId }) {
      const body = {
        category: 'linear',
        symbol: instrument,
        orderId: exchangeOrderId,
      };
      const headers = signedHeaders({ apiKey, apiSecret, params: body });
      const data = await this.fetchSigned({
        url: `${BASE_URL}/v5/order/cancel`,
        method: 'POST',
        headers,
        body,
      });
      if (data.retCode !== 0) throw new Error(`Bybit cancel error: ${data.retMsg}`);
      return { status: 'canceled' };
    },

    async fetchOrder({ apiKey, apiSecret, accountType = 'unified', instrument, exchangeOrderId }) {
      const query = new URLSearchParams({
        category: 'linear',
        symbol: instrument,
        orderId: exchangeOrderId,
      }).toString();
      const headers = signedHeaders({ apiKey, apiSecret, params: {} });
      const data = await this.fetchSigned({
        url: `${BASE_URL}/v5/order/realtime?${query}`,
        method: 'GET',
        headers,
      });
      if (data.retCode !== 0) throw new Error(`Bybit order fetch error: ${data.retMsg}`);
      const order = data.result?.list?.[0];
      if (!order) return null;
      return {
        exchangeOrderId: order.orderId,
        status: this._mapStatus(order.orderStatus),
        filledQuantity: order.cumExecQty,
        remainingQuantity: order.leavesQty,
        averageFillPrice: order.avgPrice,
      };
    },

    async fetchOpenOrders({ apiKey, apiSecret, accountType = 'unified', instrument }) {
      const params = { category: 'linear', openOnly: '0' };
      if (instrument) params.symbol = instrument;
      const query = new URLSearchParams(params).toString();
      const headers = signedHeaders({ apiKey, apiSecret, params });
      const data = await this.fetchSigned({
        url: `${BASE_URL}/v5/order/realtime?${query}`,
        method: 'GET',
        headers,
      });
      if (data.retCode !== 0) throw new Error(`Bybit open orders error: ${data.retMsg}`);

      return (data.result?.list || []).map((o) => ({
        exchangeOrderId: o.orderId,
        instrument: o.symbol,
        side: o.side.toLowerCase(),
        type: o.orderType.toLowerCase(),
        quantity: o.qty,
        filledQuantity: o.cumExecQty,
        price: o.price,
        status: this._mapStatus(o.orderStatus),
      }));
    },

    async fetchPositions({ apiKey, apiSecret }) {
      const params = { category: 'linear', settleCoin: 'USDT' };
      const query = new URLSearchParams(params).toString();
      const headers = signedHeaders({ apiKey, apiSecret, params });
      const data = await this.fetchSigned({
        url: `${BASE_URL}/v5/position/list?${query}`,
        method: 'GET',
        headers,
      });
      if (data.retCode !== 0) throw new Error(`Bybit positions error: ${data.retMsg}`);

      return (data.result?.list || [])
        .filter((p) => Number(p.size) > 0)
        .map((p) => ({
          instrument: p.symbol,
          side: p.side === 'Buy' ? 'long' : 'short',
          quantity: p.size,
          entryPrice: p.avgPrice,
          markPrice: p.markPrice,
          unrealizedPnl: p.unrealisedPnl,
          leverage: p.leverage,
          liquidationPrice: p.liqPrice,
        }));
    },

    _mapStatus(status) {
      const map = {
        New: 'submitted',
        PartiallyFilled: 'partially_filled',
        Filled: 'filled',
        Cancelled: 'canceled',
        Rejected: 'rejected',
        Deactivated: 'expired',
      };
      return map[status] || 'unknown';
    },
  };
}

export default createBybitAdapter;