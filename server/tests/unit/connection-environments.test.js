import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConnectionsService } from '../../src/modules/connections/connections.service.js';

test('rejects an environment unsupported by the selected exchange', async () => {
  const service = createConnectionsService({
    db: {},
    queries: {},
    rateLimiter: {},
    credentialVault: {},
    adapterRegistry: {},
    rateLimitCoordinator: {},
    events: {},
    audit: {},
    logger: {},
  });

  await assert.rejects(
    service.createConnection({
      userId: 'user-id',
      workspaceId: 'workspace-id',
      exchange: 'binance',
      environment: 'demo',
      label: 'Demo account',
      credentials: {},
    }),
    (error) =>
      error.code === 'VALIDATION_ERROR' &&
      error.message === 'Environment demo is not supported for binance',
  );
});

test('returns a safe exchange rejection reason during credential validation', async () => {
  const service = createConnectionsService({
    db: {},
    queries: {
      findExchangeByCode: async () => ({
        exchange_code: 'bybit',
        integration_status: 'available',
      }),
    },
    rateLimiter: {},
    credentialVault: {},
    adapterRegistry: {
      get: () => ({
        validateCredentials: async () => {
          const error = new Error('Bybit auth error: Invalid request');
          error.exchangeResponse = { retCode: 10004, retMsg: 'Error sign, please check your signature' };
          throw error;
        },
      }),
    },
    rateLimitCoordinator: {},
    events: {},
    audit: {},
    logger: { warn() {} },
  });

  await assert.rejects(
    service.createConnection({
      userId: 'user-id',
      workspaceId: 'workspace-id',
      exchange: 'bybit',
      environment: 'demo',
      label: 'Demo account',
      credentials: { apiKey: 'api-key', apiSecret: 'api-secret' },
    }),
    (error) =>
      error.message === 'Exchange rejected the credentials: Error sign, please check your signature',
  );
});

test('reports Binance geographic blocks as HTTP 451, not bad credentials', async () => {
  const service = createConnectionsService({
    db: {},
    queries: {
      findExchangeByCode: async () => ({
        exchange_code: 'binance',
        integration_status: 'available',
      }),
    },
    rateLimiter: {},
    credentialVault: {},
    adapterRegistry: {
      get: () => ({
        validateCredentials: async () => {
          const error = new Error('Exchange request failed: 451 restricted location');
          error.statusCode = 451;
          error.exchangeResponse = {
            code: 0,
            msg: 'Service unavailable from a restricted location',
          };
          throw error;
        },
      }),
    },
    rateLimitCoordinator: {},
    events: {},
    audit: {},
    logger: { warn() {} },
  });

  await assert.rejects(
    service.createConnection({
      userId: 'user-id',
      workspaceId: 'workspace-id',
      exchange: 'binance',
      environment: 'live',
      label: 'Binance',
      credentials: { apiKey: 'api-key', apiSecret: 'api-secret' },
    }),
    (error) =>
      error.status === 451 &&
      error.code === 'EXTERNAL_PROVIDER_ERROR' &&
      error.message.includes('restricted API access') &&
      error.message.includes('not an invalid API key'),
  );
});

test('reports provider CloudFront country blocks separately from invalid credentials', async () => {
  const service = createConnectionsService({
    db: {},
    queries: {
      findExchangeByCode: async () => ({
        exchange_code: 'bybit',
        integration_status: 'available',
      }),
    },
    rateLimiter: {},
    credentialVault: {},
    adapterRegistry: {
      get: () => ({
        validateCredentials: async () => {
          const error = new Error('Exchange request failed: 403');
          error.statusCode = 403;
          error.exchangeResponse = {
            raw: 'The Amazon CloudFront distribution is configured to block access from your country',
          };
          throw error;
        },
      }),
    },
    rateLimitCoordinator: {},
    events: {},
    audit: {},
    logger: { warn() {} },
  });

  await assert.rejects(
    service.createConnection({
      userId: 'user-id',
      workspaceId: 'workspace-id',
      exchange: 'bybit',
      environment: 'live',
      label: 'Bybit',
      credentials: { apiKey: 'api-key', apiSecret: 'api-secret' },
    }),
    (error) =>
      error.status === 403 &&
      error.code === 'EXTERNAL_PROVIDER_ERROR' &&
      error.message.includes('blocking API requests from the server'),
  );
});
