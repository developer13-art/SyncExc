import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.NODE_ENV = 'production';
process.env.DATABASE_URL ||= 'postgres://localhost/syncexc_test';
process.env.JWT_ACCESS_SECRET ||= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ||= 'b'.repeat(32);
process.env.SESSION_SECRET ||= 'c'.repeat(32);
process.env.ENCRYPTION_MASTER_KEY ||= Buffer.alloc(32).toString('base64');
process.env.APP_DOMAIN = 'syncexc.com';
process.env.SERVER_CORS_ORIGINS = 'https://admin.syncexc.com';

const [{ getAllowedOrigins, applySecurityMiddleware }, { default: express }, { default: request }] =
  await Promise.all([
    import('../../src/middleware/security.js'),
    import('express'),
    import('supertest'),
  ]);

test('adds only the production SyncExc website origins to configured CORS origins', () => {
  const allowed = getAllowedOrigins({
    isProduction: true,
    app: { domain: 'syncexc.com' },
    server: { corsOrigins: ['https://admin.syncexc.com'] },
  });

  assert.equal(allowed.has('https://syncexc.com'), true);
  assert.equal(allowed.has('https://www.syncexc.com'), true);
  assert.equal(allowed.has('https://app.syncexc.com'), true);
  assert.equal(allowed.has('https://admin.syncexc.com'), true);
  assert.equal(allowed.has('https://evil.syncexc.com'), false);
  assert.equal(allowed.has('http://syncexc.com'), false);
});

test('does not add production website origins in non-production environments', () => {
  const allowed = getAllowedOrigins({
    isProduction: false,
    app: { domain: 'syncexc.com' },
    server: { corsOrigins: ['http://localhost:5173'] },
  });

  assert.deepEqual([...allowed], ['http://localhost:5173']);
});

test('returns CORS headers for preflight requests from the canonical production site', async () => {
  const app = express();
  applySecurityMiddleware(app);
  app.post('/api/test', (_req, res) => res.sendStatus(200));

  const response = await request(app)
    .options('/api/test')
    .set('Origin', 'https://syncexc.com')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type,x-workspace-id');

  assert.equal(response.status, 204);
  assert.equal(response.headers['access-control-allow-origin'], 'https://syncexc.com');
  assert.equal(response.headers['access-control-allow-credentials'], 'true');
});
