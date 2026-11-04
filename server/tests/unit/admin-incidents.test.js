import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createAdminController } from '../../src/modules/admin/admin.controller.js';

function response() {
  return {
    req: { id: 'request-1', headers: {} },
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('admin incident listing forwards lifecycle filters and cursor pagination', async () => {
  let listParams;
  const controller = createAdminController({
    incidentService: {
      async list(params) {
        listParams = params;
        return { rows: [{ id: 'incident-1' }], nextCursor: 'cursor-2' };
      },
    },
  });
  const res = response();

  await controller.listIncidents({
    query: { status: 'investigating', severity: 'sev1', pageSize: '30', cursor: 'cursor-1' },
  }, res);

  assert.deepEqual(listParams, {
    status: 'investigating',
    severity: 'sev1',
    limit: 30,
    cursor: 'cursor-1',
  });
  assert.deepEqual(res.body.data, [{ id: 'incident-1' }]);
  assert.equal(res.body.pagination.nextCursor, 'cursor-2');
});

test('admin incident resolution forwards the actor and resolution metadata', async () => {
  let resolveParams;
  const controller = createAdminController({
    incidentService: {
      async resolveWithContext(params) {
        resolveParams = params;
        return { id: params.incidentId, status: 'resolved' };
      },
    },
  });
  const res = response();

  await controller.resolveIncident({
    params: { incidentId: 'incident-1' },
    auth: { userId: 'admin-1' },
    body: { summary: 'Service restored after a configuration rollback.' },
  }, res);

  assert.deepEqual(resolveParams, {
    incidentId: 'incident-1',
    actorId: 'admin-1',
    summary: 'Service restored after a configuration rollback.',
    postMortemRef: undefined,
  });
  assert.equal(res.body.data.status, 'resolved');
});
