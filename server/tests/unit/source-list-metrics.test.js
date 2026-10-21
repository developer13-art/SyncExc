import assert from 'node:assert/strict';
import test from 'node:test';

import { serializeSource } from '../../src/lib/serializers.js';
import { createSourcesQueries } from '../../src/modules/sources/sources.queries.js';

test('source serializer exposes monitoring health and ingested-message metrics', () => {
  const source = serializeSource({
    id: 'source-id',
    type: 'telegram',
    health_state: 'healthy',
    monitoring_enabled: true,
    last_monitor_error: null,
    last_event_at: '2026-10-20T12:00:00.000Z',
    message_count: 3,
  });

  assert.equal(source.healthState, 'healthy');
  assert.equal(source.monitoringEnabled, true);
  assert.equal(source.lastMonitorError, null);
  assert.equal(source.lastEventAt, '2026-10-20T12:00:00.000Z');
  assert.equal(source.messageCount, 3);
});

test('source listing and detail queries include signal-message metrics', async () => {
  const queriesRun = [];
  const db = {
    async query(sql, params) {
      queriesRun.push({ sql, params });
      return { rows: [] };
    },
  };
  const queries = createSourcesQueries({ db });

  await queries.findSourceById('source-id');
  await queries.listSourcesForWorkspace('workspace-id');

  assert.equal(queriesRun.length, 2);
  for (const query of queriesRun) {
    assert.match(query.sql, /COUNT\(\*\)::integer/);
    assert.match(query.sql, /MAX\(sm\.provider_timestamp\)/);
    assert.match(query.sql, /FROM signal_messages sm/);
  }
});
