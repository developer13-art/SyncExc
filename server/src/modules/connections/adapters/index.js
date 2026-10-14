/**
 * SyncExc Server — Exchange adapter registry
 *
 * Loads the adapters for every supported exchange and exposes them by
 * exchange code. Adapters implement the interface defined in `base.js`.
 */

import { createLogger } from '../../../lib/logger.js';
import { createBinanceAdapter } from './binance.adapter.js';
import { createBybitAdapter } from './bybit.adapter.js';
import { createBitgetAdapter } from './bitget.adapter.js';
import { createOkxAdapter } from './okx.adapter.js';

export function createAdapterRegistry({ logger, config }) {
  const log = logger || createLogger({ component: 'connections:adapters' });

  const adapters = new Map();

  adapters.set('binance', createBinanceAdapter({ config, logger: log }));
  adapters.set('bybit', createBybitAdapter({ config, logger: log }));
  adapters.set('bitget', createBitgetAdapter({ config, logger: log }));
  adapters.set('okx', createOkxAdapter({ config, logger: log }));

  log.info({ adapters: Array.from(adapters.keys()) }, 'Exchange adapter registry initialized');

  return {
    get(exchangeCode) {
      return adapters.get(exchangeCode) || null;
    },
    list() {
      return Array.from(adapters.keys());
    },
    has(exchangeCode) {
      return adapters.has(exchangeCode);
    },
  };
}

export default createAdapterRegistry;