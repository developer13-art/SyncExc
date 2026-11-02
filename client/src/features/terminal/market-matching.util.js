export function normalizeMarketType(marketType) {
  return marketType === 'perpetual' ? 'futures' : marketType ?? 'spot';
}

export function findCompatibleInstrument(instruments, selectedInstrument) {
  if (!selectedInstrument) return null;
  const matches = instruments.filter(
    (instrument) =>
      String(instrument.baseAsset).toUpperCase() ===
        String(selectedInstrument.baseAsset).toUpperCase() &&
      String(instrument.quoteAsset).toUpperCase() ===
        String(selectedInstrument.quoteAsset).toUpperCase() &&
      normalizeMarketType(instrument.marketType) ===
        normalizeMarketType(selectedInstrument.marketType),
  );
  return (
    matches.find((instrument) => instrument.tradingStatus === 'active') ??
    matches[0] ??
    null
  );
}
