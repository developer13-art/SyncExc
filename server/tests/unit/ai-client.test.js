import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { retry } from '@syncexc/shared';

import {
  createOpenAIProviderError,
  initAI,
  shouldRetryAIError,
} from '../../src/lib/ai.js';
import config from '../../src/config.js';

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

describe('Groq AI provider', () => {
  it('sends chat completions to Groq and returns the response', async () => {
    const originalProvider = config.ai.provider;
    const originalGroqConfig = config.ai.groq;
    const originalFetch = globalThis.fetch;
    let request;

    config.ai.provider = 'groq';
    config.ai.groq = {
      apiKey: 'test-groq-key',
      model: 'llama-3.3-70b-versatile',
      maxTokens: 4096,
    };
    globalThis.fetch = async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { total_tokens: 12 },
        model: 'llama-3.3-70b-versatile',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const ai = await initAI();
      const result = await ai.chat({
        system: 'Return JSON.',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 128,
        rateKey: 'groq-provider-test',
      });

      assert.equal(request.url, 'https://api.groq.com/openai/v1/chat/completions');
      assert.equal(request.options.headers.Authorization, 'Bearer test-groq-key');
      assert.deepEqual(JSON.parse(request.options.body), {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Return JSON.' },
          { role: 'user', content: 'Test' },
        ],
        max_tokens: 128,
        temperature: 0,
        response_format: { type: 'json_object' },
      });
      assert.deepEqual(result, {
        content: '{"ok":true}',
        usage: { total_tokens: 12 },
        model: 'llama-3.3-70b-versatile',
      });
    } finally {
      config.ai.provider = originalProvider;
      config.ai.groq = originalGroqConfig;
      globalThis.fetch = originalFetch;
    }
  });
});
