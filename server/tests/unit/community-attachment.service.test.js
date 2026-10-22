import test from 'node:test';
import assert from 'node:assert/strict';

import { createCommunityAttachmentService } from '../../src/modules/community/attachment.service.js';

function createService(overrides = {}) {
  const calls = [];
  const service = createCommunityAttachmentService({
    db: {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return {
          rows: [{
            id: 'attachment-id',
            file_name: 'chart.png',
            mime_type: 'image/png',
            size_bytes: 8,
          }],
        };
      },
    },
    queries: {
      attachFiles: async (_client, params) => [{
        id: params.attachmentIds[0],
        file_name: 'chart.png',
        mime_type: 'image/png',
        size_bytes: 8,
      }],
      findFile: async () => null,
      deletePendingFile: async () => null,
    },
    storage: {
      put: async () => ({ key: 'storage-key' }),
      get: async () => Buffer.from('image'),
      delete: async () => true,
    },
    ...overrides,
  });
  return { service, calls };
}

test('uploads only accepted image files and returns attachment metadata', async () => {
  const { service } = createService();
  const attachment = await service.upload({
    userId: 'user-id',
    file: {
      originalname: 'chart.png',
      mimetype: 'image/png',
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    },
  });

  assert.equal(attachment.id, 'attachment-id');
  assert.equal(attachment.name, 'chart.png');
  assert.equal(attachment.mimeType, 'image/png');
  assert.equal(attachment.sizeBytes, 8);
});

test('rejects file content that does not match its declared type', async () => {
  const { service } = createService();

  await assert.rejects(
    service.upload({
      userId: 'user-id',
      file: { originalname: 'chart.png', mimetype: 'image/png', buffer: Buffer.from('not a png') },
    }),
    /do not match/
  );
});

test('attachment IDs are associated only when uploaded by the current user and unused', async () => {
  const { service } = createService();
  await assert.rejects(
    service.attach({}, {
      userId: 'user-id',
      attachmentIds: ['attachment-id', 'other-id'],
      resourceType: 'post',
      resourceId: 'post-id',
    }),
    /invalid or already used/
  );
});
