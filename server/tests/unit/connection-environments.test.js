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

test('creates connection permissions within the same transaction as the connection', async () => {
  const permissionTransactions = [];
  const transaction = { name: 'connection transaction' };
  const connection = {
    id: 'connection-id',
    exchange_code: 'bybit',
    workspace_id: 'workspace-id',
    environment: 'demo',
  };
  const service = createConnectionsService({
    db: {
      tx: async (callback) => callback(transaction),
    },
    queries: {
      findExchangeByCode: async () => ({
        exchange_code: 'bybit',
        integration_status: 'available',
      }),
      insertConnection: async (tx) => {
        assert.equal(tx, transaction);
        return connection;
      },
      insertCredential: async (tx) => assert.equal(tx, transaction),
      upsertConnectionPermission: async (tx, permission) => {
        permissionTransactions.push(tx);
        assert.ok(permission.connectionId);
      },
      updateConnection: async (_id, update) => ({ ...connection, ...update }),
      upsertHealth: async () => {},
    },
    rateLimiter: {},
    credentialVault: {
      encryptCredentials: () => ({
        apiKeyEncrypted: 'encrypted-key',
        apiSecretEncrypted: 'encrypted-secret',
        passphraseEncrypted: null,
        keyVersion: '1',
      }),
    },
    adapterRegistry: {
      get: () => ({
        capabilities: {},
        validateCredentials: async () => ({
          canRead: true,
          canTrade: true,
          canWithdraw: false,
        }),
        discoverAccounts: async () => [],
      }),
    },
    rateLimitCoordinator: {},
    events: { publish: async (tx) => assert.equal(tx, transaction) },
    audit: {},
    logger: { warn() {} },
  });

  const result = await service.createConnection({
    userId: 'user-id',
    workspaceId: 'workspace-id',
    exchange: 'bybit',
    environment: 'demo',
    label: 'Bybit Demo',
    credentials: { apiKey: 'api-key', apiSecret: 'api-secret' },
  });

  assert.equal(permissionTransactions.length, 2);
  assert.ok(permissionTransactions.every((tx) => tx === transaction));
  assert.equal(result.status, 'degraded');
});

test('syncs an existing connection using its stored credentials', async () => {
  const connection = {
    id: 'connection-id',
    exchange_code: 'bybit',
    workspace_id: 'workspace-id',
    environment: 'demo',
    status: 'degraded',
  };
  const observed = {
    discovered: false,
    balances: false,
    equitySnapshot: false,
    instruments: false,
    active: false,
  };
  const service = createConnectionsService({
    db: {
      tx: async (callback) => callback({}),
    },
    queries: {
      findConnectionById: async () => connection,
      findActiveCredentialForConnection: async () => ({ id: 'credential-id' }),
      insertAccount: async (_tx, account) => ({
        id: 'account-id',
        ...account,
      }),
      insertBalanceSnapshot: async () => ({ id: 'snapshot-id' }),
      insertBalanceItem: async () => {},
      insertAccountSnapshot: async (_tx, snapshot) => {
        assert.equal(snapshot.accountId, 'account-id');
        assert.equal(snapshot.equity, '50123.45');
        observed.equitySnapshot = true;
      },
      upsertInstrument: async (tx) => {
        assert.ok(tx);
        observed.instruments = true;
      },
      upsertHealth: async (health) => {
        if (health.state === 'healthy') observed.healthy = true;
      },
      updateConnection: async (_id, fields) => {
        if (fields.status === 'active') observed.active = true;
        return { ...connection, ...fields };
      },
    },
    rateLimiter: {},
    credentialVault: {
      decryptCredentials: () => ({ apiKey: 'decrypted-key', apiSecret: 'decrypted-secret' }),
    },
    adapterRegistry: {
      get: () => ({
        discoverAccounts: async (credentials) => {
          assert.equal(credentials.apiKey, 'decrypted-key');
          observed.discovered = true;
          return [{ exchangeAccountId: 'main', accountType: 'spot' }];
        },
        fetchAccountState: async (credentials) => {
          assert.equal(credentials.environment, 'demo');
          observed.balances = true;
          return {
            balances: [{ asset: 'USDT', free: '10', used: '0', total: '10' }],
            equity: '50123.45',
          };
        },
        fetchInstruments: async () => [{ symbol: 'BTCUSDT' }],
      }),
    },
    rateLimitCoordinator: {},
    events: {},
    audit: {},
    logger: { warn() {} },
  });

  const result = await service.syncConnection({
    userId: 'user-id',
    workspaceId: 'workspace-id',
    connectionId: 'connection-id',
  });

  assert.equal(result.ok, true);
  assert.equal(result.connection.status, 'active');
  assert.deepEqual(observed, {
    discovered: true,
    balances: true,
    equitySnapshot: true,
    instruments: true,
    active: true,
    healthy: true,
  });
});

test('credential checks do not clear a degraded sync state or its diagnostic', async () => {
  let healthUpdate;
  const service = createConnectionsService({
    db: {},
    queries: {
      findConnectionById: async () => ({
        id: 'connection-id',
        workspace_id: 'workspace-id',
        exchange_code: 'bybit',
        environment: 'demo',
        status: 'degraded',
      }),
      findActiveCredentialForConnection: async () => ({ id: 'credential-id' }),
      getHealth: async () => ({
        state: 'degraded',
        last_error: 'Wallet permission denied',
        data_freshness: 'stale',
      }),
      upsertHealth: async (health) => {
        healthUpdate = health;
      },
    },
    rateLimiter: {},
    credentialVault: {
      decryptCredentials: () => ({ apiKey: 'key', apiSecret: 'secret' }),
    },
    adapterRegistry: {
      get: () => ({
        validateCredentials: async () => ({
          canRead: true,
          canTrade: false,
          canWithdraw: false,
        }),
      }),
    },
    rateLimitCoordinator: {},
    events: {},
    audit: {},
    logger: { warn() {} },
  });

  const result = await service.testConnection({
    userId: 'user-id',
    workspaceId: 'workspace-id',
    connectionId: 'connection-id',
  });

  assert.equal(result.ok, true);
  assert.equal(healthUpdate.state, 'degraded');
  assert.equal(healthUpdate.lastError, 'Wallet permission denied');
  assert.equal(healthUpdate.dataFreshness, 'stale');
});
