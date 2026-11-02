import { describe, expect, it } from 'vitest';

import { findCompatibleInstrument } from './market-matching.util.js';

describe('findCompatibleInstrument', () => {
  it('matches the same base asset, quote asset, and market type', () => {
    const spotMarket = {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      marketType: 'spot',
      tradingStatus: 'active',
    };

    expect(
      findCompatibleInstrument(
        [spotMarket],
        { baseAsset: 'btc', quoteAsset: 'usdt', marketType: 'spot' },
      ),
    ).toBe(spotMarket);
  });

  it('treats perpetual and futures as the same market type and prefers active matches', () => {
    const inactiveFuture = {
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      marketType: 'futures',
      tradingStatus: 'inactive',
    };
    const activeFuture = {
      ...inactiveFuture,
      symbol: 'ETH-USDT-SWAP',
      tradingStatus: 'active',
    };

    expect(
      findCompatibleInstrument(
        [inactiveFuture, activeFuture],
        { baseAsset: 'ETH', quoteAsset: 'USDT', marketType: 'perpetual' },
      ),
    ).toBe(activeFuture);
  });

  it('does not match a different quote asset or market type', () => {
    expect(
      findCompatibleInstrument(
        [
          { baseAsset: 'BTC', quoteAsset: 'USDC', marketType: 'spot' },
          { baseAsset: 'BTC', quoteAsset: 'USDT', marketType: 'futures' },
        ],
        { baseAsset: 'BTC', quoteAsset: 'USDT', marketType: 'spot' },
      ),
    ).toBeNull();
  });

  it('returns no instrument when there is no selected market', () => {
    expect(findCompatibleInstrument([], null)).toBeNull();
  });
});
