import test from 'node:test';
import assert from 'node:assert/strict';

import { createAnalysisService } from '../../src/modules/community/analysis.service.js';

function createService() {
  const versions = [];
  const updates = [];
  const tx = {
    query: async (_sql, params) => {
      updates.push(params);
      return { rows: [{ id: 'analysis-1', current_version: params[4] }] };
    },
  };
  const service = createAnalysisService({
    db: { tx: (callback) => callback(tx) },
    queries: {
      findAnalysisDocumentById: async () => ({
        id: 'analysis-1',
        author_id: 'author-1',
        current_version: 3,
      }),
      findAnalysisPermission: async () => null,
      insertAnalysisVersion: async (_client, version) => versions.push(version),
    },
    events: {},
    logger: {},
  });
  return { service, versions, updates };
}

test('metadata-only analysis edits preserve the current content version', async () => {
  const { service, versions, updates } = createService();

  await service.updateDocument({
    userId: 'author-1',
    documentId: 'analysis-1',
    title: 'Updated title',
  });

  assert.equal(versions.length, 0);
  assert.equal(updates[0][4], 3);
});

test('content edits create the next analysis version', async () => {
  const { service, versions, updates } = createService();

  await service.updateDocument({
    userId: 'author-1',
    documentId: 'analysis-1',
    content: 'Updated analysis',
  });

  assert.deepEqual(versions, [{
    documentId: 'analysis-1',
    version: 4,
    content: 'Updated analysis',
  }]);
  assert.equal(updates[0][4], 4);
});
