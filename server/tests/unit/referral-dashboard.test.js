import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createReferralController } from '../../src/modules/referral/referral.controller.js';

describe('referral dashboard endpoint', () => {
  it('returns null for a user who is not an affiliate', async () => {
    let dashboardRequested = false;
    const controller = createReferralController({
      affiliateService: {
        async getAffiliateByUserId() {
          return null;
        },
      },
      dashboardService: {
        async getDashboard() {
          dashboardRequested = true;
        },
      },
    });
    let response;
    const res = {
      req: { headers: {} },
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(body) {
        response = body;
        return this;
      },
    };

    await controller.getDashboard({ auth: { userId: 'user-1' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(response.data, null);
    assert.equal(dashboardRequested, false);
  });
});
