import { describe, expect, it } from 'vitest';

import { filterInstruments, getInstrumentValue } from './InstrumentSelector.jsx';

describe('InstrumentSelector helpers', () => {
  it('keeps every available instrument instead of truncating the catalog', () => {
    const instruments = Array.from({ length: 250 }, (_, index) => ({
      symbol: `TOKEN${index}USDT`,
      baseAsset: `TOKEN${index}`,
      quoteAsset: 'USDT',
      marketType: index % 2 === 0 ? 'spot' : 'futures',
    }));

    expect(filterInstruments(instruments)).toHaveLength(250);
    expect(filterInstruments(instruments, 'TOKEN249')).toEqual([instruments[249]]);
  });

  it('keeps identical symbols distinct across spot and futures without IDs', () => {
    const spot = { symbol: 'BTCUSDT', marketType: 'spot' };
    const futures = { symbol: 'BTCUSDT', marketType: 'futures' };

    expect(getInstrumentValue(spot)).not.toBe(getInstrumentValue(futures));
  });
});
