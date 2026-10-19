import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConnectionsQueries } from '../../src/modules/connections/connections.queries.js';

test('upserts connection permissions through the supplied transaction client', async () => {
  let executedQuery;
  let executedParams;
  const transaction = {
    async query(query, params) {
      executedQuery = query;
      executedParams = params;
      return { rows: [{ connection_id: params[0], permission_key: params[1] }] };
    },
  };
  const db = {
    query() {
      assert.fail('permission upsert must use the transaction client');
    },
  };
  const queries = createConnectionsQueries({ db });

  const permission = await queries.upsertConnectionPermission(transaction, {
    connectionId: 'connection-id',
    permissionKey: 'account.read',
    verification: 'verified',
  });

  assert.match(executedQuery, /INSERT INTO exchange_connection_permissions/);
  assert.deepEqual(executedParams, ['connection-id', 'account.read', 'verified']);
  assert.equal(permission.connection_id, 'connection-id');
});
