import { describe, expect, it } from 'vitest';

import {
  calculateOrderPreview,
  findUsdConversionMarket,
  getUsdConversionRate,
} from './order-preview.js';

describe('trading order previews', () => {
  it('uses the quote asset balance for spot buys and the base asset balance for sells', () => {
    const buy = calculateOrderPreview({
      side: 'buy',
      quantity: '2',
      price: '10',
      quoteAsset: 'USDT',
      quoteBalance: 25,
    });
    const sell = calculateOrderPreview({
      side: 'sell',
      quantity: '2',
      price: '10',
      baseAsset: 'BTC',
      baseBalance: 1.5,
    });

    expect(buy).toMatchObject({
      notional: 20,
      requiredAsset: 'USDT',
      requiredBalance: 20,
      sufficient: true,
    });
    expect(sell).toMatchObject({
      notional: 20,
      requiredAsset: 'BTC',
      requiredBalance: 2,
      sufficient: false,
    });
  });

  it('estimates futures margin using leverage and the market reference price', () => {
    const result = calculateOrderPreview({
      side: 'buy',
      marketType: 'futures',
      orderType: 'market',
      quantity: 2,
      referencePrice: 100,
      quoteAsset: 'USDT',
      quoteBalance: 15,
      leverage: 10,
    });

    expect(result).toMatchObject({
      notional: 200,
      requiredAsset: 'USDT',
      requiredBalance: 20,
      sufficient: false,
    });
  });

  it('resolves direct and inverse USD conversion markets and handles stable quotes', () => {
    const instruments = [
      {
        symbol: 'ETHUSDT',
        baseAsset: 'ETH',
        quoteAsset: 'USDT',
        marketType: 'spot',
        tradingStatus: 'active',
      },
      {
        symbol: 'USDTBTC',
        baseAsset: 'USDT',
        quoteAsset: 'BTC',
        marketType: 'spot',
        tradingStatus: 'active',
      },
    ];
    const direct = findUsdConversionMarket('ETH', instruments);
    const inverse = findUsdConversionMarket('BTC', instruments);

    expect(getUsdConversionRate('USDT', null, null)).toBe(1);
    expect(getUsdConversionRate('ETH', direct, 3000)).toBe(3000);
    expect(getUsdConversionRate('BTC', inverse, 0.00001)).toBeCloseTo(100000, 8);
    expect(getUsdConversionRate('ADA', null, null)).toBeNull();
  });
});
