import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createJobRegistry } from '../../src/jobs/registry.js';
import { registerAllHandlers } from '../../src/jobs/handlers.js';
import { NotFoundError } from '../../src/lib/errors.js';

const createLogger = () => ({ debug() {}, error() {}, info() {}, warn() {} });

async function createHandlers(services) {
  const registry = createJobRegistry({ logger: createLogger() });
  await registerAllHandlers({ registry, services });
  return registry;
}

describe('job handlers', () => {
  it('uses the public event poll method for outbox publish jobs', async () => {
    let pollCount = 0;
    const registry = await createHandlers({
      events: {},
    });

    await registry.require('outbox_publish')({
      services: {
        events: {
          async pollOnce() {
            pollCount += 1;
          },
        },
      },
    });
    assert.equal(pollCount, 1);
  });

  it('reconciles the operations returned by a scheduled sweep', async () => {
    const reconciled = [];
    const registry = await createHandlers({});

    await registry.require('sync_reconcile')({
      payload: { sweep: true },
      services: {
        synchronization: {
          queries: {
            async listOperationsPendingReconciliation() {
              return ['operation-a', 'operation-b'];
            },
          },
          reconciliation: {
            async reconcileOperation(operationId) {
              reconciled.push(operationId);
            },
          },
        },
      },
    });

    assert.deepEqual(reconciled, ['operation-a', 'operation-b']);
  });

  it('does not retry a reconciliation job for an operation that no longer exists', async () => {
    const registry = await createHandlers({});

    await assert.doesNotReject(
      registry.require('sync_reconcile')({
        payload: { operationId: 'missing-operation' },
        services: {
          synchronization: {
            reconciliation: {
              async reconcileOperation() {
                throw new NotFoundError('Operation');
              },
            },
          },
        },
      })
    );
  });

  it('checks all sources for a scheduled source-health sweep', async () => {
    let checkedAll = 0;
    const registry = await createHandlers({});

    await registry.require('source_health')({
      payload: { sweep: true },
      services: {
        sources: {
          health: {
            async checkAllSources() {
              checkedAll += 1;
            },
          },
        },
      },
    });

    assert.equal(checkedAll, 1);
  });

  it('passes an object to the source-health service for an individual check', async () => {
    let checkedSource;
    const registry = await createHandlers({});

    await registry.require('source_health')({
      payload: { sourceId: 'source-a' },
      services: {
        sources: {
          health: {
            async checkSource(options) {
              checkedSource = options;
            },
          },
        },
      },
    });

    assert.deepEqual(checkedSource, { sourceId: 'source-a' });
  });
});
