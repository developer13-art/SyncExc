/**
 * SyncExc Server — Bybit adapter
 */

import crypto from 'node:crypto';
import { ExternalProviderError } from '../../../lib/errors.js';
import { createBaseAdapter } from './base.adapter.js';

const BASE_URL = 'https://api.bybit.com';
const TESTNET_BASE_URL = 'https://api-testnet.bybit.com';
const DEMO_BASE_URL = 'https://api-demo.bybit.com';

function getBaseUrl(environment) {
  if (environment === 'testnet') return TESTNET_BASE_URL;
  if (environment === 'demo') return DEMO_BASE_URL;
  return BASE_URL;
}

export function createBybitAdapter({ config, logger }) {
  const base = createBaseAdapter({
    exchangeCode: 'bybit',
    restBaseUrl: BASE_URL,
    config,
    logger,
  });

  function signRequest({ apiKey, apiSecret, params, timestamp, recvWindow = 5000, method = 'GET' }) {
    const paramStr = typeof params === 'string'
      ? params
      : method === 'GET'
        ? new URLSearchParams(params || {}).toString()
        : JSON.stringify(params || {});
    const payload = `${timestamp}${apiKey}${recvWindow}${paramStr}`;
    return crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
  }

  function signedHeaders({ apiKey, apiSecret, params, method = 'GET' }) {
    const timestamp = Date.now();
    const signature = signRequest({ apiKey, apiSecret, params, timestamp, method });
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
      hasAttachedBracketProtectionMarkets: ['futures'],
      supportedOrderTypes: [
        'market',
        'limit',
        'stop_market',
        'stop_limit',
        'take_profit_market',
        'take_profit_limit',
      ],
      supportedTimeInForce: ['GTC', 'IOC', 'FOK', 'PostOnly'],
    },

    async validateCredentials({ apiKey, apiSecret, environment }) {
      const path = '/v5/user/query-api';
      const headers = signedHeaders({ apiKey, apiSecret, params: '' });
      const data = await this.fetchSigned({
        url: `${getBaseUrl(environment)}${path}`,
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

    async fetchAccountState({ apiKey, apiSecret, accountType = 'unified', environment }) {
      const path = '/v5/account/wallet-balance';
      const params = { accountType: accountType === 'unified' ? 'UNIFIED' : 'SPOT' };
      const query = new URLSearchParams(params).toString();
      const headers = signedHeaders({ apiKey, apiSecret, params: query });
      const data = await this.fetchSigned({
        url: `${getBaseUrl(environment)}${path}?${query}`,
        method: 'GET',
        headers,
      });

      if (data.retCode !== 0) throw new Error(`Bybit balance error: ${data.retMsg}`);

      const account = data.result?.list?.[0];
      const coins = account?.coin || [];
      return {
        balances: coins.map((c) => ({
          asset: c.coin,
          free: c.availableToWithdraw || c.walletBalance,
          used: c.locked || '0',
          total: c.walletBalance,
        })),
        equity: account?.totalEquity ?? null,
        availableEquity: account?.totalAvailableBalance ?? null,
      };
    },

    async fetchBalances(params) {
      const state = await this.fetchAccountState(params);
      return state.balances;
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

    async placeOrder({ apiKey, apiSecret, accountType = 'unified', environment, order }) {
      const marketOrderTypes = ['market', 'stop_market', 'take_profit_market'];
      const limitOrderTypes = ['limit', 'stop_limit', 'take_profit_limit'];
      if (![...marketOrderTypes, ...limitOrderTypes].includes(order.type)) {
        throw new Error(`Bybit does not support ${order.type} orders through this adapter`);
      }
      const conditionalOrder = order.type !== 'market' && order.type !== 'limit';
      if (conditionalOrder && order.marketType === 'spot') {
        throw new Error('Bybit conditional orders through this adapter require a futures/perpetual market');
      }

      let triggerDirection;
      if (conditionalOrder) {
        if (!order.triggerPrice || !Number.isFinite(Number(order.triggerPrice)) || Number(order.triggerPrice) <= 0) {
          throw new Error('Bybit conditional orders require a valid trigger price');
        }
        const category = order.marketType === 'spot' ? 'spot' : 'linear';
        const tickerQuery = new URLSearchParams({
          category,
          symbol: order.instrument,
        }).toString();
        const tickerData = await this.fetchSigned({
          url: `${getBaseUrl(environment)}/v5/market/tickers?${tickerQuery}`,
        });
        if (tickerData.retCode !== 0) {
          throw new Error(`Bybit ticker fetch error: ${tickerData.retMsg}`);
        }
        const lastPrice = Number(tickerData.result?.list?.[0]?.lastPrice);
        if (!Number.isFinite(lastPrice) || lastPrice <= 0) {
          throw new Error('Bybit did not return a valid last price for conditional order validation');
        }
        const triggerPrice = Number(order.triggerPrice);
        if (triggerPrice === lastPrice) {
          throw new Error('Bybit trigger price must differ from the current last price');
        }
        triggerDirection = triggerPrice > lastPrice ? 1 : 2;
      }

      const path = '/v5/order/create';
      const body = {
        category: order.marketType === 'spot' ? 'spot' : 'linear',
        symbol: order.instrument,
        side: order.side === 'buy' ? 'Buy' : 'Sell',
        orderType: marketOrderTypes.includes(order.type) ? 'Market' : 'Limit',
        qty: order.quantity,
      };
      if (order.price) body.price = order.price;
      if (order.stopLoss || order.takeProfit) {
        if (order.marketType !== 'futures' || !order.stopLoss || !order.takeProfit) {
          throw new Error('Bybit attached bracket protection requires futures with both stop-loss and take-profit prices');
        }
        body.tpslMode = 'Full';
        body.stopLoss = order.stopLoss;
        body.takeProfit = order.takeProfit;
      }
      if (conditionalOrder) {
        body.triggerPrice = order.triggerPrice;
        body.triggerDirection = triggerDirection;
        body.triggerBy = 'LastPrice';
      }
      if (order.clientOrderId) body.orderLinkId = order.clientOrderId;
      if (order.reduceOnly) body.reduceOnly = true;
      if (order.type === 'market') {
        body.timeInForce = 'IOC';
      } else if (limitOrderTypes.includes(order.type) && order.timeInForce) {
        body.timeInForce = order.timeInForce;
      }

      const headers = signedHeaders({ apiKey, apiSecret, params: body, method: 'POST' });
      const data = await this.fetchSigned({
        url: `${getBaseUrl(environment)}${path}`,
        method: 'POST',
        headers,
        body,
      });

      if (data.retCode !== 0) {
        const permissionError = /invalid api-key, ip, or permissions/i.test(data.retMsg || '');
        const error = new Error(
          permissionError
            ? 'Bybit rejected the API key, server IP, or trading permissions. Verify the key is active, the server IP is allowlisted, the correct environment is selected, and trading access is enabled.'
            : `Bybit order error: ${data.retMsg}`
        );
        error.exchangeResponse = { retCode: data.retCode, retMsg: data.retMsg };
        throw error;
      }

      return {
        exchangeOrderId: data.result.orderId,
        clientOrderId: data.result.orderLinkId,
        status: 'submitted',
      };
    },

    async cancelOrder({
      apiKey,
      apiSecret,
      accountType = 'unified',
      environment,
      instrument,
      exchangeOrderId,
    }) {
      const body = {
        category: 'linear',
        symbol: instrument,
        orderId: exchangeOrderId,
      };
      const headers = signedHeaders({ apiKey, apiSecret, params: body, method: 'POST' });
      const data = await this.fetchSigned({
        url: `${getBaseUrl(environment)}/v5/order/cancel`,
        method: 'POST',
        headers,
        body,
      });
      if (data.retCode !== 0) throw new Error(`Bybit cancel error: ${data.retMsg}`);
      return { status: 'canceled' };
    },

    async fetchOrder({
      apiKey,
      apiSecret,
      accountType = 'unified',
      environment,
      instrument,
      exchangeOrderId,
      marketType,
    }) {
      const params = {
        category: marketType === 'spot' ? 'spot' : 'linear',
        symbol: instrument,
        orderId: exchangeOrderId,
      };
      const query = new URLSearchParams(params).toString();
      const headers = signedHeaders({ apiKey, apiSecret, params: query });
      const realtimeData = await this.fetchSigned({
        url: `${getBaseUrl(environment)}/v5/order/realtime?${query}`,
        method: 'GET',
        headers,
      });
      if (realtimeData.retCode !== 0) {
        throw new Error(`Bybit order fetch error: ${realtimeData.retMsg}`);
      }

      let order = realtimeData.result?.list?.[0];
      if (!order) {
        const historyHeaders = signedHeaders({ apiKey, apiSecret, params: query });
        const historyData = await this.fetchSigned({
          url: `${getBaseUrl(environment)}/v5/order/history?${query}`,
          method: 'GET',
          headers: historyHeaders,
        });
        if (historyData.retCode !== 0) {
          throw new Error(`Bybit order history fetch error: ${historyData.retMsg}`);
        }
        order = historyData.result?.list?.[0];
      }
      if (!order) return null;
      return {
        exchangeOrderId: order.orderId,
        status: this._mapStatus(order.orderStatus),
        filledQuantity: order.cumExecQty,
        remainingQuantity: order.leavesQty,
        averageFillPrice: order.avgPrice,
      };
    },

    async fetchOpenOrders({ apiKey, apiSecret, accountType = 'unified', environment, instrument }) {
      const params = { category: 'linear', openOnly: '0' };
      if (instrument) params.symbol = instrument;
      const query = new URLSearchParams(params).toString();
      const headers = signedHeaders({ apiKey, apiSecret, params: query });
      const data = await this.fetchSigned({
        url: `${getBaseUrl(environment)}/v5/order/realtime?${query}`,
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

    async fetchPositions({ apiKey, apiSecret, environment }) {
      const params = { category: 'linear', settleCoin: 'USDT' };
      const query = new URLSearchParams(params).toString();
      const headers = signedHeaders({ apiKey, apiSecret, params: query });
      const data = await this.fetchSigned({
        url: `${getBaseUrl(environment)}/v5/position/list?${query}`,
        method: 'GET',
        headers,
      });
      if (data.retCode !== 0) {
        throw new ExternalProviderError(
          `Bybit position sync failed: ${data.retMsg}`,
          {
            provider: 'bybit',
            status: 502,
            details: { providerCode: data.retCode, stage: 'position sync' },
          },
        );
      }

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

    async fetchClosedPnl({
      apiKey,
      apiSecret,
      environment,
      cursor,
      startTime,
    }) {
      const params = { category: 'linear', limit: '100' };
      if (cursor) params.cursor = cursor;
      if (startTime) params.startTime = String(startTime);
      const query = new URLSearchParams(params).toString();
      const headers = signedHeaders({ apiKey, apiSecret, params: query });
      const data = await this.fetchSigned({
        url: `${getBaseUrl(environment)}/v5/position/closed-pnl?${query}`,
        method: 'GET',
        headers,
      });
      if (data.retCode !== 0) {
        throw new ExternalProviderError(
          `Bybit closed P&L sync failed: ${data.retMsg}`,
          {
            provider: 'bybit',
            status: 502,
            details: { providerCode: data.retCode, stage: 'closed P&L sync' },
          },
        );
      }

      const result = data.result || {};
      return {
        trades: (result.list || []).map((item) => ({
          exchangeTradeId: [
            item.orderId,
            item.createdTime,
            item.closedSize,
          ].join(':'),
          exchangeOrderId: item.orderId,
          instrument: item.symbol,
          side: String(item.side || '').toLowerCase() === 'buy' ? 'long' : 'short',
          quantity: item.closedSize,
          entryPrice: item.avgEntryPrice || null,
          exitPrice: item.avgExitPrice,
          realizedPnl: item.closedPnl,
          pnlAsset: item.settleCoin || null,
          feeAmount: item.closeFee || null,
          feeAsset: item.settleCoin || null,
          closedAt: item.updatedTime || item.createdTime,
          exchangePayload: item,
        })),
        nextCursor: result.nextPageCursor || null,
      };
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