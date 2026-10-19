import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyErrorMiddleware } from '../../src/middleware/error.js';

test('reports duplicate exchange labels with actionable conflict details', () => {
  const handlers = [];
  applyErrorMiddleware(
    { use: (handler) => handlers.push(handler) },
    { warn() {}, error() {} },
  );

  const errorHandler = handlers[1];
  let responseBody;
  let responseStatus;
  const req = {
    id: 'request-id',
    method: 'POST',
    originalUrl: '/api/v1/connections',
    auth: { userId: 'user-id' },
    workspace: { id: 'workspace-id' },
    params: {},
    query: {},
  };
  const res = {
    headersSent: false,
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  errorHandler(
    { code: '23505', constraint: 'exchange_connections_label_unique' },
    req,
    res,
    () => {},
  );

  assert.equal(responseStatus, 409);
  assert.equal(responseBody.error.code, 'CONNECTION_LABEL_CONFLICT');
  assert.match(responseBody.error.message, /Choose another label/);
  assert.equal(
    responseBody.error.details.constraint,
    'exchange_connections_label_unique',
  );
});
