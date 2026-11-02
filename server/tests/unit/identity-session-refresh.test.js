import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.NODE_ENV = 'production';
process.env.DATABASE_URL ||= 'postgres://localhost/syncexc_test';
process.env.JWT_ACCESS_SECRET ||= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ||= 'b'.repeat(32);
process.env.SESSION_SECRET ||= 'c'.repeat(32);
process.env.ENCRYPTION_MASTER_KEY ||= Buffer.alloc(32).toString('base64');
delete process.env.SESSION_COOKIE_DOMAIN;
delete process.env.SESSION_COOKIE_SECURE;
delete process.env.SESSION_COOKIE_SAME_SITE;

const [
  { createIdentityRoutes },
  { default: express },
  { default: cookieParser },
  { default: request },
  { default: config },
  { verifyAccessToken },
] = await Promise.all([
  import('../../src/modules/identity/identity.routes.js'),
  import('express'),
  import('cookie-parser'),
  import('supertest'),
  import('../../src/config.js'),
  import('../../src/lib/jwt.js'),
]);

function passthrough() {
  return (_req, _res, next) => next();
}

const middleware = {
  authLimiter: passthrough(),
  asyncHandler: (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next),
  loadUserIfAuthenticated: passthrough,
  requireAuth: () => (req, _res, next) => {
    req.auth = { userId: 'user-1', sessionId: 'session-1' };
    next();
  },
  requireStepUp: passthrough,
  validateBody: passthrough,
  validateParams: passthrough,
  validateQuery: passthrough,
};

const app = express();
app.use(cookieParser());
app.use('/auth', createIdentityRoutes({ service: {}, middleware }).auth);
app.use((error, _req, res, _next) => {
  res.status(error.status ?? 500).json({ error: { code: error.code } });
});

test('production session cookies use secure cross-site settings and no invalid domain', () => {
  assert.equal(config.session.cookieSecure, true);
  assert.equal(config.session.cookieSameSite, 'none');
  assert.equal(config.session.cookieDomain, undefined);
});

test('refresh issues a new access token only for a browser session cookie', async () => {
  const unauthenticated = await request(app).post('/auth/refresh');
  assert.equal(unauthenticated.status, 401);

  const response = await request(app)
    .post('/auth/refresh')
    .set('Cookie', `${config.session.cookieName}=active-session`);

  assert.equal(response.status, 200);
  const claims = verifyAccessToken(response.body.data.accessToken);
  assert.equal(claims.sub, 'user-1');
  assert.equal(claims.sid, 'session-1');
  assert.equal(claims.aud, 'syncexc-api');
  assert.equal(claims.iss, 'syncexc');
  assert.equal(typeof claims.iat, 'number');
  assert.equal(typeof claims.exp, 'number');
});
