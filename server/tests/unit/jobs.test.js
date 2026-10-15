import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createJobRunner } from '../../src/jobs/runner.js';

describe('job runner', () => {
  it('provides the initialized services bundle to job handlers', async () => {
    const expectedServices = { synchronization: { reconciliation: {} } };
    let claimed = false;
    let resolveHandler;
    const handlerCalled = new Promise((resolve) => {
      resolveHandler = resolve;
    });
    const logger = { debug() {}, error() {}, info() {}, warn() {} };
    const db = {
      async query(sql) {
        if (sql.includes('WITH claimed AS')) {
          if (claimed) return { rows: [] };
          claimed = true;
          return {
            rows: [{
              id: 'job-1',
              job_type: 'sync_reconcile',
              payload: { operationId: 'operation-1' },
              attempts: 1,
              max_attempts: 5,
              correlation_id: null,
            }],
          };
        }
        return { rows: [] };
      },
    };
    const registry = {
      get: () => async ({ services }) => resolveHandler(services),
    };
    const runner = createJobRunner({ db, registry, logger, services: expectedServices });

    try {
      await runner.start();
      const receivedServices = await handlerCalled;
      assert.strictEqual(receivedServices, expectedServices);
    } finally {
      await runner.stop();
    }
  });
});
