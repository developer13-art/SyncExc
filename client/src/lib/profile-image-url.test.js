import { describe, expect, test } from 'vitest';
import { resolveProfileImageUrl } from './profile-image-url.js';

describe('resolveProfileImageUrl', () => {
  test('rewrites legacy localhost media URLs to the configured API origin', () => {
    expect(
      resolveProfileImageUrl(
        'http://localhost:4000/api/v1/users/media/avatar.png',
        'https://syncexc-server.onrender.com/api/v1',
        'https://syncexc.com',
      ),
    ).toBe('https://syncexc-server.onrender.com/api/v1/users/media/avatar.png');
  });

  test('leaves unrelated external image URLs unchanged', () => {
    const url = 'https://images.example.com/avatar.png';
    expect(
      resolveProfileImageUrl(url, 'https://api.example.com/api/v1', 'https://app.example.com'),
    ).toBe(url);
  });
});
