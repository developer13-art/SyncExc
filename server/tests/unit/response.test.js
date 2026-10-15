import { test } from 'node:test';
import assert from 'node:assert/strict';

test('response helpers shape output correctly', () => {
  // Simple mock response
  function mockRes() {
    const res = {
      statusCode: 200,
      body: null,
      req: { id: 'test-request', headers: {} },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
      end() {
        return this;
      },
    };
    return res;
  }

  const { success, created, paginated, errorResponse } = require('../../src/lib/response.js');

  const res1 = mockRes();
  success(res1, { foo: 'bar' });
  assert.equal(res1.statusCode, 200);
  assert.deepEqual(res1.body.data, { foo: 'bar' });
  assert.ok(res1.body.meta.timestamp);

  const res2 = mockRes();
  created(res2, { id: 'x' });
  assert.equal(res2.statusCode, 201);

  const res3 = mockRes();
  paginated(res3, [{ id: 1 }, { id: 2 }], { nextCursor: 'abc', limit: 2 });
  assert.equal(res3.statusCode, 200);
  assert.equal(res3.body.data.length, 2);
  assert.equal(res3.body.pagination.nextCursor, 'abc');

  const res4 = mockRes();
  errorResponse(res4, { code: 'TEST', message: 'oops', status: 400 });
  assert.equal(res4.statusCode, 400);
  assert.equal(res4.body.error.code, 'TEST');
});