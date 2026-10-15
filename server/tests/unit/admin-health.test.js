import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createAdminController } from '../../src/modules/admin/admin.controller.js';

describe('admin health controller', () => {
  it('reports database status in the service-health response', async () => {
    const controller = createAdminController({
      db: {
        async health() {
          return { ok: true };
        },
      },
    });
    const response = {
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

    await controller.getHealth({}, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.overallStatus, 'healthy');
    assert.deepEqual(response.body.data.services, [
      { name: 'Database', status: 'healthy' },
    ]);
    assert.deepEqual(response.body.data.activeIncidents, []);
  });
});
