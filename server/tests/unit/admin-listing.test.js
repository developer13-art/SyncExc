import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PaginationSchema } from '@syncexc/shared';
import { SourceCandidateQuerySchema } from '../../src/modules/admin/admin.routes.js';
import { createAdminSourceReviewService } from '../../src/modules/admin/admin-source-review.service.js';

describe('admin listing query support', () => {
  it('accepts the page and pageSize parameters used by the admin console', () => {
    const { error, value } = PaginationSchema.validate({
      page: '2',
      pageSize: '25',
    });

    it('accepts source candidate status, search, and pagination filters', () => {
      const { error, value } = SourceCandidateQuerySchema.validate({
        status: 'pending_review',
        q: 'telegram',
        page: '1',
        pageSize: '25',
      });

      assert.equal(error, undefined);
      assert.equal(value.status, 'pending_review');
      assert.equal(value.q, 'telegram');
      assert.equal(value.pageSize, 25);
    });

    assert.equal(error, undefined);
    assert.equal(value.page, 2);
    assert.equal(value.pageSize, 25);
  });

  it('qualifies source candidate status and returns pagination metadata', async () => {
    let query;
    let params;
    const service = createAdminSourceReviewService({
      db: {
        async query(sql, values) {
          query = sql;
          params = values;
          return {
            rows: [{
              id: 'candidate-1',
              total_count: '3',
            }],
          };
        },
      },
    });

    const result = await service.listCandidates({
      status: 'pending_review',
      limit: 1,
      offset: 1,
    });

    assert.match(query, /WHERE c\.status = \$2/);
    assert.match(query, /OFFSET \$3/);
    assert.deepEqual(params, [1, 'pending_review', 1]);
    assert.deepEqual(result, {
      rows: [{ id: 'candidate-1' }],
      total: 3,
    });
  });
});
