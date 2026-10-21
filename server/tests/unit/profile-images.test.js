import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createDatabaseProfileImageStorage,
  createProfileImageService,
} from '../../src/lib/profile-images.js';

describe('profile image storage', () => {
  it('stores image bytes in the database and retrieves/deletes them by generated key', async () => {
    const rows = new Map();
    const db = {
      async query(sql, params) {
        if (sql.startsWith('INSERT INTO profile_images')) {
          rows.set(params[0], { image_data: params[2] });
          return { rowCount: 1, rows: [] };
        }
        if (sql.startsWith('SELECT image_data FROM profile_images')) {
          const row = rows.get(params[0]);
          return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
        }
        if (sql.startsWith('DELETE FROM profile_images')) {
          return { rowCount: Number(rows.delete(params[0])), rows: [] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      },
    };
    const storage = createDatabaseProfileImageStorage({ db });
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const stored = await storage.put({
      buffer: image,
      mimeType: 'image/png',
      extension: 'png',
    });

    assert.match(stored.key, /^[\da-f-]{36}\.png$/i);
    assert.deepEqual(await storage.get(stored.key), image);
    assert.equal(await storage.delete(stored.key), true);
    assert.equal(await storage.get(stored.key), null);
  });

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
