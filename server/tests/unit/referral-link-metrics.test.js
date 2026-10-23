import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createReferralQueries } from '../../src/modules/referral/referral.queries.js';

describe('referral link metrics', () => {
  it('returns click, registration, and conversion metrics for each link', async () => {
    let queryText;
    const link = {
      id: 'link-1',
      code: 'ABC123',
      clicks: 3,
      registrations: 1,
      conversions: 0,
    };
    const queries = createReferralQueries({
      db: {
        async query(text, params) {
          queryText = text;
          assert.deepEqual(params, ['affiliate-1']);
          return { rows: [link] };
        },
      },
    });

    const result = await queries.listLinksForAffiliate('affiliate-1');

    assert.deepEqual(result, [link]);
    assert.match(queryText, /referral_click_events/);
    assert.match(queryText, /referral_attributions/);
    assert.match(queryText, /AS registrations/);
    assert.match(queryText, /AS conversions/);
  });
});
