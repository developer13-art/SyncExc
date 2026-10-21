import { describe, expect, test } from 'vitest';
import { getErrorMessage, parseAxiosError } from './errors.js';

describe('API error correlation', () => {
  test('includes the server request ID in the user-facing error message', () => {
    const error = parseAxiosError({
      response: {
        status: 500,
        data: {
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
          meta: { requestId: 'request-123' },
        },
        headers: {},
      },
    });

    expect(getErrorMessage(error)).toBe('Internal server error (Reference: request-123)');
  });
});
