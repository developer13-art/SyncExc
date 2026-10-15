import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createAdminController } from '../../src/modules/admin/admin.controller.js';

describe('admin user audit endpoint', () => {
  it('filters audit events by user and returns the paginated response', async () => {
    let filters;
    let response;
    const controller = createAdminController({
      adminAuditService: {
        async search(value) {
          filters = value;
          return {
            rows: [{ id: 'audit-event-1' }],
            nextCursor: '2026-10-15T13:00:00.000Z',
          };
        },
      },
    });

    const res = {
      status(statusCode) {
        response = { status: statusCode };
        return this;
      },
      json(body) {
        response.body = body;
        return this;
      },
      req: { headers: {} },
    };

    await controller.searchUserAudit(
      {
        params: { userId: 'user-1' },
        query: { pageSize: '10', cursor: '2026-10-15T12:00:00.000Z' },
      },
      res
    );

    assert.deepEqual(filters, {
      targetId: 'user-1',
      limit: 10,
      cursor: '2026-10-15T12:00:00.000Z',
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, [{ id: 'audit-event-1' }]);
    assert.equal(response.body.pagination.nextCursor, '2026-10-15T13:00:00.000Z');
    assert.equal(response.body.pagination.limit, 10);
  });
});
