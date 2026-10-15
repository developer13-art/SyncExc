import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import request from 'supertest';

const requiredTestEnvironment = {
  DATABASE_URL: 'postgres://test:test@localhost:5432/test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  SESSION_SECRET: 'c'.repeat(32),
  ENCRYPTION_MASTER_KEY: 'test-encryption-key',
};

for (const [key, value] of Object.entries(requiredTestEnvironment)) {
  process.env[key] ??= value;
}
process.env.NODE_ENV ??= 'test';

let app;

before(async () => {
  const { buildApp } = await import('../../src/app.js');
  app = buildApp();
});

describe('server health and API routes', () => {
  it('reports liveness', async () => {
    const response = await request(app).get('/health/live').expect(200);

    assert.equal(response.body.data.status, 'ok');
  });

  it('reports readiness unavailable until the database is initialized', async () => {
    const response = await request(app).get('/health/ready').expect(503);

    assert.equal(response.body.error.code, 'NOT_READY');
  });

  it('mounts API routes and returns not found for an unregistered endpoint', async () => {
    const response = await request(app).get('/api/v1/auth/session').expect(404);

    assert.notEqual(response.body.error.code, 'API_UNAVAILABLE');
  });
});
