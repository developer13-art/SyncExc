/**
 * SyncExc Server — AI client
 *
 * Thin wrapper around the configured LLM provider. Every AI call:
 *   - has a hard timeout
 *   - retries transient failures with bounded backoff
 *   - is rate limited per minute
 *   - returns plain text (callers parse per their schema)
 *
 * AI is used for interpretation, extraction, and recommendations.
 * AI never authorizes, never executes, and never bypasses validation.
 */

import config from '../config.js';
import { createLogger } from './logger.js';
import { AppError } from './errors.js';
import { retry } from '@syncexc/shared';

const logger = createLogger({ component: 'ai' });

const rateBuckets = new Map();

function checkRateLimit(key) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const bucket = rateBuckets.get(key) || [];
  const recent = bucket.filter((t) => t > windowStart);
  if (recent.length >= config.ai.rateLimitPerMinute) {
    throw new AppError('AI rate limit exceeded', {
      code: 'AI_RATE_LIMITED',
      status: 429,
      expose: true,
    });
  }
  recent.push(now);
  rateBuckets.set(key, recent);
}

async function callOpenAI({ system, messages, maxTokens, temperature = 0 }) {
  const apiKey = config.ai.openai.apiKey;
  if (!apiKey) throw new AppError('OpenAI API key not configured', { code: 'AI_NOT_CONFIGURED', status: 500 });

  const body = {
    model: config.ai.openai.model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
    max_tokens: maxTokens || config.ai.openai.maxTokens,
    temperature,
    response_format: { type: 'json_object' },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AppError(`OpenAI request failed: ${res.status}`, {
        code: 'AI_PROVIDER_ERROR',
        status: 502,
        expose: false,
        details: { status: res.status, body: text.slice(0, 500) },
      });
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new AppError('OpenAI returned empty response', { code: 'AI_EMPTY_RESPONSE', status: 502 });
    return {
      content,
      usage: json.usage,
      model: json.model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropic({ system, messages, maxTokens, temperature = 0 }) {
  const apiKey = config.ai.anthropic.apiKey;
  if (!apiKey) throw new AppError('Anthropic API key not configured', { code: 'AI_NOT_CONFIGURED', status: 500 });

  const body = {
    model: config.ai.anthropic.model,
    system: system || undefined,
    messages,
    max_tokens: maxTokens || 4096,
    temperature,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AppError(`Anthropic request failed: ${res.status}`, {
        code: 'AI_PROVIDER_ERROR',
        status: 502,
        details: { status: res.status, body: text.slice(0, 500) },
      });
    }

    const json = await res.json();
    const content = json?.content?.[0]?.text;
    if (!content) throw new AppError('Anthropic returned empty response', { code: 'AI_EMPTY_RESPONSE', status: 502 });
    return {
      content,
      usage: json.usage,
      model: json.model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGoogle({ system, messages, maxTokens, temperature = 0 }) {
  const apiKey = config.ai.google.apiKey;
  if (!apiKey) throw new AppError('Google AI API key not configured', { code: 'AI_NOT_CONFIGURED', status: 500 });

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
  }));

  const body = {
    contents,
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens || 4096,
      responseMimeType: 'application/json',
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.ai.google.model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AppError(`Google AI request failed: ${res.status}`, {
        code: 'AI_PROVIDER_ERROR',
        status: 502,
        details: { status: res.status, body: text.slice(0, 500) },
      });
    }

    const json = await res.json();
    const content = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new AppError('Google AI returned empty response', { code: 'AI_EMPTY_RESPONSE', status: 502 });
    return {
      content,
      usage: json.usageMetadata,
      model: config.ai.google.model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callLocal({ system, messages, maxTokens, temperature = 0 }) {
  const url = `${config.ai.local.baseUrl}/api/chat`;

  const body = {
    model: config.ai.local.model,
    stream: false,
    options: { temperature, num_predict: maxTokens || 4096 },
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AppError(`Local LLM request failed: ${res.status}`, {
        code: 'AI_PROVIDER_ERROR',
        status: 502,
        details: { status: res.status, body: text.slice(0, 500) },
      });
    }

    const json = await res.json();
    const content = json?.message?.content;
    if (!content) throw new AppError('Local LLM returned empty response', { code: 'AI_EMPTY_RESPONSE', status: 502 });
    return { content, model: config.ai.local.model };
  } finally {
    clearTimeout(timeout);
  }
}

const PROVIDERS = {
  openai: callOpenAI,
  anthropic: callAnthropic,
  google: callGoogle,
  local: callLocal,
};

export async function initAI() {
  const provider = PROVIDERS[config.ai.provider];
  if (!provider) {
    throw new AppError(`Unsupported AI provider: ${config.ai.provider}`, {
      code: 'AI_PROVIDER_UNSUPPORTED',
      status: 500,
    });
  }

  logger.info({ provider: config.ai.provider }, 'AI client initialized');

  return {
    provider: config.ai.provider,

    /**
     * Chat completion.
     *
     * @param {Object} opts
     * @param {string} [opts.system]
     * @param {Array<{role: string, content: string}>} opts.messages
     * @param {number} [opts.maxTokens]
     * @param {number} [opts.temperature]
     * @param {string} [opts.rateKey]
     * @returns {Promise<{ content: string, usage?: object, model?: string }>}
     */
    async chat({ system, messages, maxTokens, temperature = 0, rateKey = 'global' }) {
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new AppError('AI chat requires at least one message', { code: 'AI_BAD_REQUEST', status: 400 });
      }

      checkRateLimit(rateKey);

      return retry(
        async () => provider({ system, messages, maxTokens, temperature }),
        { attempts: config.ai.maxRetries + 1, baseMs: 500, maxMs: 8000 }
      );
    },

    /**
     * Chat completion expecting JSON. Parses the response and returns the object.
     * Throws on parse failure so callers can treat it as a processing failure.
     */
    async chatJson({ system, messages, maxTokens, temperature = 0, rateKey = 'global' }) {
      const result = await this.chat({ system, messages, maxTokens, temperature, rateKey });
      let parsed;
      try {
        parsed = JSON.parse(result.content);
      } catch (err) {
        throw new AppError('AI returned invalid JSON', {
          code: 'AI_INVALID_JSON',
          status: 502,
          details: { sample: String(result.content).slice(0, 500) },
          cause: err,
        });
      }
      return { ...result, data: parsed };
    },
  };
}

export default initAI;