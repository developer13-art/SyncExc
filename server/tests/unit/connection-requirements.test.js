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
