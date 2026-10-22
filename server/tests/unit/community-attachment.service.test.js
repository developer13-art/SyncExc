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
  const { service, calls } = createService();
  const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const attachment = await service.upload({
    userId: 'user-id',
    file: {
      originalname: 'chart.png',
      mimetype: 'image/png',
      buffer: image,
    },
  });

  assert.equal(attachment.id, 'attachment-id');
  assert.equal(attachment.name, 'chart.png');
  assert.equal(attachment.mimeType, 'image/png');
  assert.equal(attachment.sizeBytes, 8);
  assert.match(calls[0].sql, /file_data/);
  assert.deepEqual(calls[0].params[5], image);
});

test('downloads persisted attachment bytes without relying on local filesystem storage', async () => {
  const image = Buffer.from('persisted image');
  let storageRead = false;
  const { service } = createService({
    queries: {
      findFile: async () => ({
        id: 'attachment-id',
        uploader_id: 'user-id',
        storage_key: 'database:attachment-key.png',
        file_name: 'chart.png',
        mime_type: 'image/png',
        file_data: image,
      }),
    },
    storage: {
      get: async () => {
        storageRead = true;
        return null;
      },
    },
  });

  const downloaded = await service.download({
    userId: 'user-id',
    attachmentId: 'attachment-id',
  });

  assert.deepEqual(downloaded.buffer, image);
  assert.equal(storageRead, false);
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
