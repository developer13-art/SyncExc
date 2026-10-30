import assert from 'node:assert/strict';
import express from 'express';
import { before, describe, it } from 'node:test';
import request from 'supertest';

import { createMarketplaceRoutes } from '../../src/modules/marketplace/marketplace.routes.js';

describe('marketplace follow routes', () => {
  let app;
  const follows = [{ id: 'follow-1', provider_id: 'provider-1' }];

  before(() => {
    const middleware = new Proxy({}, {
      get(_target, name) {
        if (name === 'requireAuth') {
          return () => (req, _res, next) => {
            req.auth = { userId: 'user-1' };
            next();
          };
        }
        if (name === 'asyncHandler') {
          return (handler) => (req, res, next) =>
            Promise.resolve(handler(req, res)).catch(next);
        }
        return () => (_req, _res, next) => next();
      },
    });

    app = express();
    app.use('/marketplace', createMarketplaceRoutes({
      middleware,
      followService: {
        async listFollowing({ userId }) {
          assert.equal(userId, 'user-1');
          return follows;
        },
      },
    }));
  });

  for (const path of ['/following', '/follows']) {
    it(`lists followed providers at ${path}`, async () => {
      const response = await request(app)
        .get(`/marketplace${path}`)
        .expect(200);

      assert.deepEqual(response.body.data, follows);
    });
  }
});
