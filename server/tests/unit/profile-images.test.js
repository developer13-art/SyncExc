import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createProfileImageService } from '../../src/lib/profile-images.js';

describe('profile image storage', () => {
  it('stores verified image bytes and serves only generated image keys', async () => {
    const saved = new Map();
    const storage = {
      async put({ buffer, mimeType, extension }) {
        const key = `b75a9f11-1111-4111-8111-111111111111.${extension}`;
        saved.set(key, { buffer, mimeType });
        return { key };
      },
      async get(key) {
        return saved.get(key)?.buffer ?? null;
      },
      async delete(key) {
        return saved.delete(key);
      },
    };
    const images = createProfileImageService({
      storage,
      baseUrl: 'https://api.example.test',
      apiPrefix: '/api/v1',
    });
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

    const uploaded = await images.upload({ buffer, mimeType: 'image/jpeg' });
    assert.equal(
      uploaded.url,
      'https://api.example.test/api/v1/users/media/b75a9f11-1111-4111-8111-111111111111.jpg',
    );
    assert.deepEqual(await images.get('b75a9f11-1111-4111-8111-111111111111.jpg'), {
      buffer,
      mimeType: 'image/jpeg',
    });
    assert.equal(await images.get('../outside.jpg'), null);
    await images.remove(uploaded.url);
    assert.equal(saved.size, 0);
  });

  it('rejects image files whose MIME type does not match their contents', async () => {
    const images = createProfileImageService({
      storage: { async put() { throw new Error('must not store invalid files'); } },
      baseUrl: 'https://api.example.test',
      apiPrefix: '/api/v1',
    });

    await assert.rejects(
      images.upload({ buffer: Buffer.from('not an image'), mimeType: 'image/png' }),
      { code: 'VALIDATION_ERROR' },
    );
    await assert.rejects(images.upload(null), { code: 'VALIDATION_ERROR' });
  });
});
