import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { retry } from '@syncexc/shared';

import {
  createOpenAIProviderError,
  shouldRetryAIError,
} from '../../src/lib/ai.js';

describe('AI provider errors', () => {
  it('identifies exhausted OpenAI quota without retaining provider response text', async () => {
    const error = createOpenAIProviderError(
      429,
      {
        error: {
          message: 'Sensitive provider response',
          type: 'insufficient_quota',
          code: 'credit_balance_exhausted',
        },
      },
      'req_test_123'
    );

    assert.equal(error.code, 'AI_QUOTA_EXHAUSTED');
    assert.equal(error.status, 503);
    assert.equal(shouldRetryAIError(error), false);
    assert.deepEqual(error.details, {
      status: 429,
      providerType: 'insufficient_quota',
      providerCode: 'credit_balance_exhausted',
      requestId: 'req_test_123',
    });
    assert.equal(JSON.stringify(error.details).includes('Sensitive provider response'), false);

    let attempts = 0;
    await assert.rejects(
      retry(
        async () => {
          attempts += 1;
          throw error;
        },
        { attempts: 4, shouldRetry: shouldRetryAIError }
      ),
      { code: 'AI_QUOTA_EXHAUSTED' }
    );
    assert.equal(attempts, 1);
  });

  it('keeps transient OpenAI rate limits retryable', () => {
    const error = createOpenAIProviderError(429, {
      error: {
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded',
      },
    });

    assert.equal(error.code, 'AI_PROVIDER_ERROR');
    assert.equal(shouldRetryAIError(error), true);
  });
});
