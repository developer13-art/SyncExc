import { ValidationError } from './errors.js';

const IMAGE_TYPES = Object.freeze({
  'image/jpeg': {
    extension: 'jpg',
    matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  'image/png': {
    extension: 'png',
    matches: (buffer) =>
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    extension: 'webp',
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP',
  },
});

const CONTENT_TYPES_BY_EXTENSION = Object.freeze({
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
});

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_KEY_PATTERN = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}\.(jpg|png|webp)$/i;

export function createProfileImageService({ storage, baseUrl, apiPrefix }) {
  const mediaPath = `${apiPrefix.replace(/\/+$/, '')}/users/media/`;
  const origin = new URL(baseUrl).origin;

  async function upload(file) {
    const { buffer, mimeType } = file ?? {};
    const type = IMAGE_TYPES[mimeType];
    if (!buffer?.length) throw new ValidationError('Choose a non-empty image file');
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new ValidationError('Profile images must be 5 MB or smaller');
    }
    if (!type || !type.matches(buffer)) {
      throw new ValidationError('Upload a valid JPEG, PNG, or WebP image');
    }
    const stored = await storage.put({
      buffer,
      mimeType,
      extension: type.extension,
    });
    return {
      key: stored.key,
      url: new URL(`${mediaPath}${stored.key}`, baseUrl).toString(),
    };
  }

  function keyFromUrl(url) {
    if (typeof url !== 'string') return null;
    try {
      const parsed = new URL(url);
      if (parsed.origin !== origin || !parsed.pathname.startsWith(mediaPath)) return null;
      const key = parsed.pathname.slice(mediaPath.length);
      return IMAGE_KEY_PATTERN.test(key) ? key : null;
    } catch {
      return null;
    }
  }

  async function remove(url) {
    const key = keyFromUrl(url);
    if (key) await storage.delete(key);
  }

  async function get(key) {
    if (typeof key !== 'string' || !IMAGE_KEY_PATTERN.test(key)) return null;
    const buffer = await storage.get(key);
    if (!buffer) return null;
    const extension = key.split('.').at(-1).toLowerCase();
    return { buffer, mimeType: CONTENT_TYPES_BY_EXTENSION[extension] };
  }

  return { upload, remove, get };
}

export default createProfileImageService;
