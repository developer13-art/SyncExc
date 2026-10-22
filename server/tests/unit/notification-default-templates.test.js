import test from 'node:test';
import assert from 'node:assert/strict';

import { createTemplateService } from '../../src/modules/notifications/templates.js';
import { createEventRegistry } from '../../src/modules/notifications/event-registry.service.js';

test('default notification event types persist within a database transaction', async () => {
  const calls = [];
  const tx = {
    query: async (_sql, params) => {
      calls.push(params);
      return { rows: [] };
    },
  };
  const registry = createEventRegistry({
    db: { tx: (callback) => callback(tx) },
    queries: {
      upsertEventType: async (client, data) => {
        assert.equal(client, tx);
        calls.push(data);
      },
    },
    logger: { info() {} },
  });

  await registry.persistDefaults();

  assert.ok(calls.some((item) => item.eventType === 'execution.order_rejected'));
});

test('default rejected-order template can be registered and rendered', async () => {
  const templates = new Map();
  const versions = new Map();
  const queries = {
    findTemplate: async (key) => templates.get(key) || null,
    insertTemplate: async (_tx, data) => {
      const template = { id: data.key, ...data };
      templates.set(data.key, template);
      return template;
    },
    insertTemplateVersion: async (_tx, data) => {
      const version = {
        id: `${data.templateId}:${data.version}:${data.locale}`,
        ...data,
        title_template: data.titleTemplate,
        body_template: data.bodyTemplate,
        action_template: data.actionTemplate,
      };
      versions.set(version.id, version);
      return version;
    },
    findLatestTemplateVersion: async (templateId) =>
      versions.get(`${templateId}:1:en`) || null,
    listTemplates: async () => [...templates.values()],
  };
  const service = createTemplateService({
    db: { tx: (callback) => callback({}) },
    queries,
    logger: { info() {} },
  });

  await service.registerDefaults();
  const result = await service.getTemplate({ key: 'trading.order_rejected' });
  const rendered = service.render({
    template: result.version,
    data: {
      instrument: '0GUSDT',
      side: 'buy',
      reason: 'Bybit rejected the API key or trading permissions.',
      orderId: 'order-id',
      appUrl: 'https://syncexc.com',
    },
  });

  assert.equal(rendered.title, 'Order rejected: 0GUSDT');
  assert.match(rendered.body, /buy order on 0GUSDT was rejected/);
  assert.match(rendered.body, /Bybit rejected the API key/);
});
