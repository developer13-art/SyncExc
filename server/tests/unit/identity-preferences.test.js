import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createIdentityService } from '../../src/modules/identity/identity.service.js';

describe('identity preferences', () => {
  it('provides safe defaults when a user has not saved preferences', async () => {
    const service = createIdentityService({
      db: {},
      queries: { async getUserPreferences() { return null; } },
    });

    assert.deepEqual(await service.getUserPreferences('user-1'), {
      general: { theme: 'system' },
      trading: {
        defaultMarketType: 'spot',
        defaultOrderType: 'limit',
        defaultChartTimeframe: '1h',
      },
    });
  });

  it('saves partial preference updates transactionally and publishes an audit event', async () => {
    const transaction = {};
    let savedUpdates;
    let publishedEvent;
    const service = createIdentityService({
      db: {
        async tx(callback) {
          return callback(transaction);
        },
      },
      queries: {
        async upsertUserPreferences(_userId, updates, client) {
          savedUpdates = updates;
          assert.equal(client, transaction);
          return {
            general_preferences: { theme: 'dark' },
            trading_preferences: { defaultOrderType: 'market' },
          };
        },
      },
      events: {
        async publish(client, eventName, payload, metadata) {
          publishedEvent = { client, eventName, payload, metadata };
        },
      },
    });

    const result = await service.updateUserPreferences({
      userId: 'user-1',
      updates: { trading: { defaultOrderType: 'market' } },
    });

    assert.deepEqual(savedUpdates, { trading: { defaultOrderType: 'market' } });
    assert.deepEqual(result, {
      general: { theme: 'dark' },
      trading: {
        defaultMarketType: 'spot',
        defaultOrderType: 'market',
        defaultChartTimeframe: '1h',
      },
    });
    assert.equal(publishedEvent.client, transaction);
    assert.equal(publishedEvent.eventName, 'user.preferences_updated');
    assert.deepEqual(publishedEvent.payload.sections, ['trading']);
  });
});
