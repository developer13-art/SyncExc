/**
 * Exchange TP/SL compatibility policy.
 *
 * Market/order matrix:
 * - Spot is unleveraged (1x); a Spot entry does not create a leveraged
 *   position. TP/SL is allowed only when the adapter declares exchange-managed
 *   conditional protection attached to the entry order for that exact type.
 * - Futures/perpetuals use exchange margin and leverage. Native position
 *   protection is allowed only when the adapter explicitly declares support
 *   for that market and order type.
 * - Spot Market + TP/SL is never silently rewritten as a Limit order and
 *   never submitted without protection. Post-fill trigger emulation is not
 *   enabled until a fill-confirmed protection coordinator is available.
 * - A single TP or SL leg is rejected; protected entries require both legs.
 *
 * New adapters should declare capabilities.bracketProtection. Legacy adapters
 * using hasAttachedBracketProtection* remain supported, with Spot interpreted
 * as entry-attached conditional protection and Futures as native position
 * protection.
 */

const EMPTY_TYPES = Object.freeze([]);

function normalizeMarketType(marketType) {
  if (marketType === 'perpetual') return 'futures';
  return marketType;
}

function unsupported({ marketType, orderType, code, message, strategy = 'unsupported' }) {
  return {
    supported: false,
    marketType,
    orderType,
    strategy,
    code,
    warning: message,
  };
}

export function resolveBracketProtectionPlan({
  capabilities,
  marketType: requestedMarketType,
  orderType: requestedOrderType,
  stopLoss,
  takeProfit,
}) {
  const marketType = normalizeMarketType(requestedMarketType);
  const orderType = String(requestedOrderType || 'market').toLowerCase();
  const hasStopLoss = stopLoss != null && String(stopLoss).trim() !== '';
  const hasTakeProfit = takeProfit != null && String(takeProfit).trim() !== '';

  if (!['spot', 'futures'].includes(marketType)) {
    return unsupported({
      marketType,
      orderType,
      code: 'MARKET_TYPE_UNSUPPORTED',
      message: `Unsupported market type "${requestedMarketType}". Use Spot or Futures/Perpetuals.`,
    });
  }

  if (!hasStopLoss && !hasTakeProfit) {
    return {
      supported: true,
      marketType,
      orderType,
      strategy: 'none',
      warning: null,
    };
  }

  if (!hasStopLoss || !hasTakeProfit) {
    return unsupported({
      marketType,
      orderType,
      code: 'TP_SL_PAIR_REQUIRED',
      message: 'Both stop-loss and take-profit are required for protected entry execution.',
    });
  }

  const declaredPolicy = capabilities?.bracketProtection?.[marketType];
  if (declaredPolicy) {
    if ((declaredPolicy.nativePositionOrderTypes || EMPTY_TYPES).includes(orderType)) {
      return {
        supported: true,
        marketType,
        orderType,
        strategy: 'native_position',
        warning: null,
      };
    }

    if (
      marketType === 'spot' &&
      (declaredPolicy.entryAttachedConditionalOrderTypes || EMPTY_TYPES).includes(orderType)
    ) {
      return {
        supported: true,
        marketType,
        orderType,
        strategy: 'entry_attached_conditional',
        warning: null,
      };
    }

    if ((declaredPolicy.postFillConditionalOrderTypes || EMPTY_TYPES).includes(orderType)) {
      return unsupported({
        marketType,
        orderType,
        code: 'TP_SL_EMULATION_UNAVAILABLE',
        strategy: 'post_fill_emulation_unavailable',
        message: `This exchange requires post-fill ${marketType} TP/SL triggers for ${orderType} orders, but post-fill protection emulation is not active. No order was submitted.`,
      });
    }
  } else {
    const legacyMarkets = capabilities?.hasAttachedBracketProtectionMarkets || EMPTY_TYPES;
    const legacyOrderTypes =
      capabilities?.hasAttachedBracketProtectionOrderTypes?.[marketType];
    const legacySupportsOrder = Array.isArray(legacyOrderTypes)
      ? legacyOrderTypes.includes(orderType)
      : ['market', 'limit'].includes(orderType);

    if (legacyMarkets.includes(marketType) && legacySupportsOrder) {
      return {
        supported: true,
        marketType,
        orderType,
        strategy: marketType === 'spot'
          ? 'entry_attached_conditional'
          : 'native_position',
        warning: null,
      };
    }
  }

  const message = marketType === 'spot'
    ? `Spot ${orderType} orders do not have declared exchange-managed TP/SL protection. The requested Spot order with attached stop-loss and take-profit is not supported for this market and order type. No order was submitted. Post-fill trigger emulation is not enabled.`
    : `Futures/Perpetuals ${orderType} orders do not have declared native TP/SL protection, so this destination was not submitted.`;
  return unsupported({
    marketType,
    orderType,
    code: 'TP_SL_PROTECTION_UNSUPPORTED',
    message,
  });
}

export default resolveBracketProtectionPlan;
