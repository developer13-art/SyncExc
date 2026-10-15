import assert from 'node:assert/strict';
import express from 'express';
import { before, describe, it } from 'node:test';
import request from 'supertest';

import middleware from '../../src/middleware/index.js';
import { applyErrorMiddleware } from '../../src/middleware/error.js';
import { createAdminAuthRoutes } from '../../src/modules/admin/admin-auth.routes.js';

describe('admin authentication routes', () => {
  let app;

  before(() => {
    const revokedSessions = [];
    const identity = {
      service: {
        async login() {
          return {
            user: {
              id: 'admin-1',
              email: 'admin@example.com',
              email_verified_at: new Date(),
              username: 'admin',
              display_name: 'Platform Administrator',
              status: 'active',
            },
            session: { id: 'session-1' },
            sessionToken: 'session-token',
            accessToken: 'access-token',
          };
        },
        async revokeSession(session) {
          revokedSessions.push(session);
        },
      },
    };
    const permission = {
      async getEffectivePermissions() {
        return { roles: ['platform_administrator'], permissions: new Set(['*']) };
      },
    };
    const authMiddleware = {
      ...middleware,
      authLimiter: (_req, _res, next) => next(),
      requireAuth: () => (req, _res, next) => {
        req.auth = { isAuthenticated: true, userId: 'admin-1', sessionId: 'session-1' };
        next();
      },
      requireAdmin: () => (_req, _res, next) => next(new Error('Unexpected admin guard')),
    };

    app = express();
    app.use(express.json());
    app.use('/admin/auth', createAdminAuthRoutes({
      identity,
      permission,
      middleware: authMiddleware,
    }));
    app.locals.revokedSessions = revokedSessions;
    applyErrorMiddleware(app, { error() {} });
  });

  it('allows unauthenticated admin login and returns the admin session', async () => {
    const response = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'Valid-password-123!' })
      .expect(200);

    assert.equal(response.body.data.admin.id, 'admin-1');
    assert.deepEqual(response.body.data.admin.roles, ['platform_administrator']);
    assert.equal(response.body.data.accessToken, 'access-token');
    assert.match(response.headers['set-cookie'][0], /syncexc_session=session-token/);
  });

  it('allows an authenticated user to revoke their own session at logout', async () => {
    await request(app).post('/admin/auth/logout').expect(204);

    assert.deepEqual(app.locals.revokedSessions, [
      { userId: 'admin-1', sessionId: 'session-1' },
    ]);
  });
});
