import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ORDER_STATUS } from '@syncexc/shared';
import { createTerminalService } from '../../src/modules/terminal/terminal.service.js';

test('expands the open status alias to active order states', async () => {
  let queryOptions;
  const queries = {
    async listOrders(_workspaceId, options) {
      queryOptions = options;
      return { rows: [], nextCursor: null };
    },
  };
  const service = createTerminalService({
    db: {},
    queries,
    marketData: {},
    events: {},
    audit: {},
    logger: {},
  });

  await service.listOrdersForScope({
    workspaceId: 'workspace-id',
    statuses: ['open'],
    accountId: 'account-id',
    limit: 50,
  });

  assert.deepEqual(queryOptions.statuses, [
    ORDER_STATUS.PENDING_SUBMISSION,
    ORDER_STATUS.SUBMITTED,
    ORDER_STATUS.ACKNOWLEDGED,
    ORDER_STATUS.PARTIALLY_FILLED,
    ORDER_STATUS.CANCEL_REQUESTED,
    ORDER_STATUS.UNKNOWN,
    ORDER_STATUS.RECONCILIATION_REQUIRED,
  ]);
  assert.equal(queryOptions.accountId, 'account-id');
});
