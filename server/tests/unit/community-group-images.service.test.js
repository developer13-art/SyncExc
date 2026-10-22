import test from 'node:test';
import assert from 'node:assert/strict';

import { createGroupService } from '../../src/modules/community/group.service.js';

function createService({ upload = async () => ({ url: 'https://media.example/new.png' }), remove = async () => {} } = {}) {
  const calls = [];
  const service = createGroupService({
    db: {},
    queries: {
      findGroupById: async () => ({
        id: 'group-id',
        owner_id: 'owner-id',
        avatar_url: 'https://media.example/old.png',
      }),
      findGroupRole: async () => null,
      updateGroup: async (groupId, fields) => {
        calls.push({ groupId, fields });
        return { id: groupId, ...fields };
      },
    },
    events: {},
    profileImages: { upload, remove },
    logger: { warn() {} },
  });
  return { service, calls };
}

test('group owners can replace the group profile image and the old image is removed', async () => {
  const removed = [];
  const { service, calls } = createService({
    remove: async (url) => removed.push(url),
  });

  const group = await service.updateGroupImage({
    groupId: 'group-id',
    userId: 'owner-id',
    imageType: 'avatar',
    file: { buffer: Buffer.from('image'), mimeType: 'image/png' },
  });

  assert.equal(group.avatarUrl, 'https://media.example/new.png');
  assert.deepEqual(calls, [{
    groupId: 'group-id',
    fields: { avatarUrl: 'https://media.example/new.png' },
  }]);
  assert.deepEqual(removed, ['https://media.example/old.png']);
});

test('unsupported group image types are rejected before upload', async () => {
  let uploadCalled = false;
  const { service } = createService({
    upload: async () => {
      uploadCalled = true;
      return { url: 'https://media.example/new.png' };
    },
  });

  await assert.rejects(
    service.updateGroupImage({
      groupId: 'group-id',
      userId: 'owner-id',
      imageType: 'banner',
      file: { buffer: Buffer.from('image'), mimeType: 'image/png' },
    }),
    /Unsupported group image type/
  );
  assert.equal(uploadCalled, false);
});

test('group image upload is restricted to owner and administrators', async () => {
  const { service } = createService();

  await assert.rejects(
    service.updateGroupImage({
      groupId: 'group-id',
      userId: 'other-user',
      imageType: 'cover',
      file: { buffer: Buffer.from('image'), mimeType: 'image/png' },
    }),
    /Group moderator permission required/
  );
});
