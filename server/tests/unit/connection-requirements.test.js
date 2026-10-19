import assert from 'node:assert/strict';
import { test } from 'node:test';

const { createConnectionsController } = await import(
  '../../src/modules/connections/connections.controller.js'
);

test('requires an API-key passphrase for Bitget and OKX connections', async () => {
  const controller = createConnectionsController({ service: {} });

  for (const exchangeCode of ['bitget', 'okx']) {
    let response;
    const res = {
      req: { headers: {} },
      status(status) {
        this.statusCode = status;
        return this;
      },
      json(body) {
        response = body;
        return this;
      },
    };

    await controller.getConnectionRequirements(
      { params: { exchangeCode } },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(
      response.data.requirements.find((requirement) => requirement.name === 'passphrase')
        ?.required,
      true,
    );
  }
});

test('only requires API key and secret for Binance and Bybit', async () => {
  const controller = createConnectionsController({ service: {} });

  for (const exchangeCode of ['binance', 'bybit']) {
    let response;
    const res = {
      req: { headers: {} },
      status() {
        return this;
      },
      json(body) {
        response = body;
        return this;
      },
    };

    await controller.getConnectionRequirements(
      { params: { exchangeCode } },
      res,
    );

    assert.deepEqual(
      response.data.requirements.map((requirement) => requirement.name),
      ['apiKey', 'apiSecret'],
    );
  }
});

test('offers demo mode only for exchanges with demo API support', async () => {
  const controller = createConnectionsController({ service: {} });

  for (const [exchangeCode, expectedModes] of [
    ['binance', ['live', 'testnet']],
    ['bybit', ['live', 'demo', 'testnet']],
    ['bitget', ['live', 'demo']],
    ['okx', ['live', 'demo']],
  ]) {
    let response;
    const res = {
      req: { headers: {} },
      status() {
        return this;
      },
      json(body) {
        response = body;
        return this;
      },
    };

    await controller.getConnectionRequirements(
      { params: { exchangeCode } },
      res,
    );

    assert.deepEqual(
      response.data.environments.map((environment) => environment.value),
      expectedModes,
    );
  }
});

test('returns stored verified permissions when creating or rotating a connection', async () => {
  const connection = {
    id: 'connection-id',
    workspace_id: 'workspace-id',
    owner_id: 'user-id',
    exchange_code: 'bybit',
    environment: 'demo',
    label: 'Bybit Demo',
    status: 'active',
  };
  const permissions = [
    { permission_key: 'account.read', verification: 'verified' },
    { permission_key: 'trading', verification: 'missing_permission' },
  ];
  const service = {
    createConnection: async () => connection,
    rotateCredentials: async () => ({ id: 'credential-id' }),
    listPermissions: async () => permissions,
  };
  const controller = createConnectionsController({ service });
  const createResponse = {
    req: { headers: {} },
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await controller.createConnection(
    {
      auth: { userId: 'user-id' },
      workspace: { id: 'workspace-id' },
      body: {
        exchange: 'bybit',
        environment: 'demo',
        label: 'Bybit Demo',
        credentials: { apiKey: 'key', apiSecret: 'secret' },
      },
    },
    createResponse,
  );

  assert.equal(createResponse.statusCode, 201);
  assert.deepEqual(createResponse.body.data.permissions, {
    'account.read': 'verified',
    trading: 'missing_permission',
  });

  const rotateResponse = {
    req: { headers: {} },
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await controller.rotateCredentials(
    {
      auth: { userId: 'user-id' },
      workspace: { id: 'workspace-id' },
      params: { connectionId: 'connection-id' },
      body: { credentials: { apiKey: 'key', apiSecret: 'secret' } },
    },
    rotateResponse,
  );

  assert.equal(rotateResponse.statusCode, 200);
  assert.deepEqual(rotateResponse.body.data.permissions, {
    'account.read': 'verified',
    trading: 'missing_permission',
  });
});
