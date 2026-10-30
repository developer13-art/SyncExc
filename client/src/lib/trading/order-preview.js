const USD_PEGGED_ASSETS = new Set(['USDT', 'USDC']);

export function findUsdConversionMarket(asset, instruments = []) {
  const normalizedAsset = String(asset || '').toUpperCase();
  if (!normalizedAsset || normalizedAsset === 'USD' || USD_PEGGED_ASSETS.has(normalizedAsset)) {
    return null;
  }

  const spotInstruments = instruments.filter(
    (instrument) => instrument.marketType === 'spot' && instrument.tradingStatus === 'active',
  );
  const direct = spotInstruments.find(
    (instrument) =>
      String(instrument.baseAsset || '').toUpperCase() === normalizedAsset &&
      String(instrument.quoteAsset || '').toUpperCase() === 'USDT',
  );
  if (direct) return { instrument: direct, inverted: false };

  const inverse = spotInstruments.find(
    (instrument) =>
      String(instrument.baseAsset || '').toUpperCase() === 'USDT' &&
      String(instrument.quoteAsset || '').toUpperCase() === normalizedAsset,
  );
  return inverse ? { instrument: inverse, inverted: true } : null;
}

export function getUsdConversionRate(asset, conversionMarket, marketPrice) {
  const normalizedAsset = String(asset || '').toUpperCase();
  if (normalizedAsset === 'USD' || USD_PEGGED_ASSETS.has(normalizedAsset)) return 1;
  if (!conversionMarket) return null;

  const price = Number(marketPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  return conversionMarket.inverted ? 1 / price : price;
}

export function calculateOrderPreview({
  side,
  marketType = 'spot',
  orderType,
  quantity,
  price,
  referencePrice,
  baseAsset,
  quoteAsset,
  baseBalance,
  quoteBalance,
  leverage = 1,
}) {
  const isFutures = marketType === 'futures' || marketType === 'perpetual';
  const isMarketOrder = orderType === 'market' || orderType === 'stop_market';
  const resolvedPrice = Number(isMarketOrder ? referencePrice : price);
  const normalizedQuantity = Number(quantity);
  const notional = Number.isFinite(resolvedPrice) && resolvedPrice > 0 &&
      Number.isFinite(normalizedQuantity) && normalizedQuantity > 0
    ? resolvedPrice * normalizedQuantity
    : null;

  const isSpotSell = !isFutures && side === 'sell';
  const requiredAsset = isSpotSell ? baseAsset : quoteAsset;
  const rawAvailableBalance = isSpotSell ? baseBalance : quoteBalance;
  const availableBalance =
    rawAvailableBalance === null || rawAvailableBalance === undefined || rawAvailableBalance === ''
      ? null
      : Number(rawAvailableBalance);
  const normalizedLeverage = Math.max(1, Number(leverage) || 1);
  const requiredBalance = notional === null
    ? null
    : isSpotSell
      ? normalizedQuantity
      : isFutures
        ? notional / normalizedLeverage
        : notional;

  return {
    notional,
    requiredAsset,
    requiredBalance,
    availableBalance:
      availableBalance !== null && Number.isFinite(availableBalance) ? availableBalance : null,
    sufficient:
      requiredBalance === null || !Number.isFinite(availableBalance)
        ? null
        : availableBalance >= requiredBalance,
  };
}
