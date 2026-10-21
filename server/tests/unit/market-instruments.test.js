import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createConnectionsQueries } from '../../src/modules/connections/connections.queries.js';

describe('market instrument identity', () => {
  it('upserts identical symbols independently for each market type', async () => {
    let statement;
    const queries = createConnectionsQueries({ db: {} });
    const client = {
      async query(sql) {
        statement = sql;
        return { rows: [{ exchange_symbol: 'BTCUSDT', market_type: 'futures' }] };
      },
    };

    await queries.upsertInstrument(client, {
      exchangeCode: 'bybit',
      exchangeSymbol: 'BTCUSDT',
      normalizedSymbol: 'BTCUSDT',
      marketType: 'futures',
      tickSize: '0.1',
      quantityStep: '0.001',
    });

    assert.match(statement, /ON CONFLICT \(exchange_code, exchange_symbol, market_type\)/);
  });

  it('looks up an instrument by its market type as well as its symbol', async () => {
    let statement;
    let values;
    const queries = createConnectionsQueries({
      db: {
        async query(sql, parameters) {
          statement = sql;
          values = parameters;
          return { rows: [] };
        },
      },
    });

    await queries.findInstrument('bybit', 'BTCUSDT', 'futures');

    assert.match(statement, /exchange_symbol = \$2 AND market_type = \$3/);
    assert.deepEqual(values, ['bybit', 'BTCUSDT', 'futures']);
  });
});
