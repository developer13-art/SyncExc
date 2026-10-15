/**
 * SyncExc Server — Fill engine
 *
 * Models order execution under different fill assumptions. Every fill model
 * is a real implementation that produces deterministic or seeded output.
 *
 * Models:
 *   immediate_simplified  — fill at the next price with fixed slippage
 *   trade_based           — use observed trades in a window with liquidity assumption
 *   order_book_based      — consume order-book levels until filled
 *   partial_fill          — model partial execution over time
 *   latency_aware         — delay fill by a configured latency
 *   failure_injection     — inject rejections/timeouts at configured rates
 */

export function createFillEngine({ logger }) {
  /**
   * @param {Object} params
   * @param {Object} params.order         { side, type, quantity, price, triggerPrice }
   * @param {Object} params.market        { price, bid, ask, trades, depth }
   * @param {Object} params.config        Fill model config
   * @param {Object} params.account       { balances }
   * @returns {Object}                    { filledQuantity, averageFillPrice, fills[], rejection }
   */
  function execute({ order, market, config, account }) {
    const model = config.fillModel || 'immediate_simplified';

    switch (model) {
      case 'immediate_simplified':
        return immediateSimplified({ order, market, config });
      case 'trade_based':
        return tradeBased({ order, market, config });
      case 'order_book_based':
        return orderBookBased({ order, market, config });
      case 'partial_fill':
        return partialFill({ order, market, config });
      case 'latency_aware':
        return latencyAware({ order, market, config });
      case 'failure_injection':
        return failureInjection({ order, market, config });
      default:
        throw new Error(`Unknown fill model: ${model}`);
    }
  }

  /* ===========================================================================
   * IMMEDIATE SIMPLIFIED
   * ======================================================================== */

  function immediateSimplified({ order, market, config }) {
    const slippageBps = config.slippageBps || 0;
    const referencePrice = resolveReferencePrice(order, market);
    if (!referencePrice) {
      return { rejection: 'no_reference_price' };
    }

    const basePrice = Number(referencePrice);
    const direction = order.side === 'buy' ? 1 : -1;
    const executionPrice = basePrice * (1 + direction * (slippageBps / 10000));

    const fees = computeFees({
      quantity: order.quantity,
      price: executionPrice,
      feeBps: config.takerFeeBps || 0,
    });

    return {
      filledQuantity: String(order.quantity),
      averageFillPrice: executionPrice.toFixed(8),
      fills: [
        {
          quantity: String(order.quantity),
          price: executionPrice.toFixed(8),
          fee: fees.fee,
          feeAsset: fees.feeAsset,
          executedAt: market.timestamp || new Date().toISOString(),
        },
      ],
    };
  }

  /* ===========================================================================
   * TRADE BASED
   * ======================================================================== */

  function tradeBased({ order, market, config }) {
    const trades = market.trades || [];
    if (trades.length === 0) {
      return { rejection: 'no_trades' };
    }

    const liquidityRatio = config.liquidityRatio ?? 0.1;
    const availableLiquidity = trades.reduce((sum, t) => sum + Number(t.quantity || 0), 0) * liquidityRatio;
    const requestedQty = Number(order.quantity);

    if (availableLiquidity <= 0) {
      return { rejection: 'no_liquidity' };
    }

    const fillQty = Math.min(requestedQty, availableLiquidity);
    const vwap = computeVWAP(trades, order.side, fillQty);
    const fees = computeFees({
      quantity: fillQty,
      price: vwap,
      feeBps: config.takerFeeBps || 0,
    });

    const fills = [];
    let remaining = fillQty;
    for (const trade of trades) {
      if (remaining <= 0) break;
      const qty = Math.min(remaining, Number(trade.quantity) * liquidityRatio);
      if (qty <= 0) continue;
      fills.push({
        quantity: qty.toFixed(8),
        price: String(trade.price),
        fee: computeFees({ quantity: qty, price: Number(trade.price), feeBps: config.takerFeeBps || 0 }).fee,
        feeAsset: fees.feeAsset,
        executedAt: trade.timestamp || market.timestamp,
      });
      remaining -= qty;
    }

    return {
      filledQuantity: fillQty.toFixed(8),
      averageFillPrice: vwap.toFixed(8),
      fills,
    };
  }

  function computeVWAP(trades, side, targetQty) {
    let notional = 0;
    let qty = 0;
    for (const t of trades) {
      if (qty >= targetQty) break;
      const tradeQty = Math.min(targetQty - qty, Number(t.quantity || 0));
      notional += tradeQty * Number(t.price);
      qty += tradeQty;
    }
    return qty > 0 ? notional / qty : 0;
  }

  /* ===========================================================================
   * ORDER BOOK BASED
   * ======================================================================== */

  function orderBookBased({ order, market, config }) {
    const depth = market.depth;
    if (!depth) return { rejection: 'no_order_book' };

    const levels = order.side === 'buy' ? depth.asks || [] : depth.bids || [];
    if (levels.length === 0) return { rejection: 'empty_book_side' };

    const requestedQty = Number(order.quantity);
    let remaining = requestedQty;
    let notional = 0;
    const fills = [];

    for (const level of levels) {
      if (remaining <= 0) break;
      const levelQty = Number(level.quantity);
      const levelPrice = Number(level.price);
      const fillQty = Math.min(remaining, levelQty);
      notional += fillQty * levelPrice;
      remaining -= fillQty;

      const fees = computeFees({
        quantity: fillQty,
        price: levelPrice,
        feeBps: config.takerFeeBps || 0,
      });

      fills.push({
        quantity: fillQty.toFixed(8),
        price: levelPrice.toFixed(8),
        fee: fees.fee,
        feeAsset: fees.feeAsset,
        executedAt: market.timestamp,
      });
    }

    if (fills.length === 0) return { rejection: 'insufficient_liquidity' };

    const filledQty = requestedQty - remaining;
    const avgPrice = filledQty > 0 ? notional / filledQty : 0;

    return {
      filledQuantity: filledQty.toFixed(8),
      averageFillPrice: avgPrice.toFixed(8),
      fills,
      partial: remaining > 0,
    };
  }

  /* ===========================================================================
   * PARTIAL FILL
   * ======================================================================== */

  function partialFill({ order, market, config }) {
    const maxFillRatio = config.maxFillRatio ?? 0.5;
    const referencePrice = resolveReferencePrice(order, market);
    if (!referencePrice) return { rejection: 'no_reference_price' };

    const fillQty = Number(order.quantity) * maxFillRatio;
    const direction = order.side === 'buy' ? 1 : -1;
    const executionPrice = Number(referencePrice) * (1 + direction * ((config.slippageBps || 0) / 10000));

    const fees = computeFees({
      quantity: fillQty,
      price: executionPrice,
      feeBps: config.takerFeeBps || 0,
    });

    return {
      filledQuantity: fillQty.toFixed(8),
      averageFillPrice: executionPrice.toFixed(8),
      fills: [
        {
          quantity: fillQty.toFixed(8),
          price: executionPrice.toFixed(8),
          fee: fees.fee,
          feeAsset: fees.feeAsset,
          executedAt: market.timestamp,
        },
      ],
      partial: maxFillRatio < 1,
    };
  }

  /* ===========================================================================
   * LATENCY AWARE
   * ======================================================================== */

  function latencyAware({ order, market, config }) {
    const latencyMs = config.latencyMs || 100;
    const futureTimestamp = new Date(
      new Date(market.timestamp || Date.now()).getTime() + latencyMs
    ).toISOString();

    // Use the price at the delayed timestamp if available, otherwise current
    const delayedPrice = market.delayedPrice || market.price;
    if (!delayedPrice) return { rejection: 'no_delayed_price' };

    const direction = order.side === 'buy' ? 1 : -1;
    const executionPrice = Number(delayedPrice) * (1 + direction * ((config.slippageBps || 0) / 10000));

    const fees = computeFees({
      quantity: order.quantity,
      price: executionPrice,
      feeBps: config.takerFeeBps || 0,
    });

    return {
      filledQuantity: String(order.quantity),
      averageFillPrice: executionPrice.toFixed(8),
      latencyMs,
      fills: [
        {
          quantity: String(order.quantity),
          price: executionPrice.toFixed(8),
          fee: fees.fee,
          feeAsset: fees.feeAsset,
          executedAt: futureTimestamp,
        },
      ],
    };
  }

  /* ===========================================================================
   * FAILURE INJECTION
   * ======================================================================== */

  function failureInjection({ order, market, config }) {
    const rng = createSeededRandom(config.seed || 42);
    const rejectionRate = config.rejectionRate || 0.1;
    const timeoutRate = config.timeoutRate || 0.05;

    const roll = rng();

    if (roll < rejectionRate) {
      return { rejection: 'simulated_rejection', reason: config.rejectionReason || 'injected' };
    }

    if (roll < rejectionRate + timeoutRate) {
      return { rejection: 'simulated_timeout' };
    }

    // Otherwise fill using immediate model
    return immediateSimplified({ order, market, config });
  }

  /* ===========================================================================
   * HELPERS
   * ======================================================================== */

  function resolveReferencePrice(order, market) {
    if (order.type === 'market') {
      if (order.side === 'buy') return market.ask || market.price;
      return market.bid || market.price;
    }
    return order.price || market.price;
  }

  function computeFees({ quantity, price, feeBps }) {
    const notional = Number(quantity) * Number(price);
    const fee = (notional * feeBps) / 10000;
    return {
      fee: fee.toFixed(8),
      feeAsset: 'USDT',
    };
  }

  /**
   * Deterministic seeded RNG. Uses a simple LCG.
   */
  function createSeededRandom(seed) {
    let state = seed % 2147483647;
    if (state <= 0) state += 2147483646;
    return function next() {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };
  }

  return {
    execute,
    createSeededRandom,
  };
}

export default createFillEngine;