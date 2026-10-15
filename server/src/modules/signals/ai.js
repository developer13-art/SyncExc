/**
 * SyncExc Server — AI interpreter service
 *
 * Uses the LLM to interpret messages that the deterministic parser could
 * not resolve. The AI returns a strict JSON schema; anything that does not
 * match is rejected.
 */

import { AppError } from '../../lib/errors.js';

const EXTRACTION_SCHEMA_PROMPT = `You are a trading signal extractor. Extract structured data from trading signals.
Return ONLY valid JSON matching this exact schema:
{
  "isSignal": boolean,
  "instrument": string | null,
  "marketType": "spot" | "futures" | "perpetual" | null,
  "direction": "long" | "short" | null,
  "entry": string | null,
  "entryRange": { "min": string, "max": string } | null,
  "stopLoss": string | null,
  "targets": string[],
  "leverage": string | null,
  "confidence": number (0-1),
  "reason": string,
  "issues": string[]
}

Rules:
- If a field is not explicitly stated, use null. Never invent values.
- If the message is not a trade signal, set isSignal=false.
- Only extract numerical values when the meaning is unambiguous.
- Confidence reflects how sure you are of the extraction, not trade quality.`;

export function createAiInterpreterService({ db, queries, ai, logger }) {
  async function interpret({ messageId, content }) {
    if (!ai) {
      throw new AppError('AI provider not configured', { code: 'AI_NOT_CONFIGURED', status: 500 });
    }

    const { content: rawResponse, data, model, usage } = await ai.chatJson({
      system: EXTRACTION_SCHEMA_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Extract the trading signal from this message:\n\n${content}`,
        },
      ],
      rateKey: 'signal:interpret',
    });

    // Validate against expectations
    if (typeof data !== 'object' || data === null) {
      throw new AppError('AI returned non-object JSON', {
        code: 'AI_INVALID_JSON',
        status: 502,
      });
    }

    // Normalize
    const normalized = {
      isSignal: Boolean(data.isSignal),
      instrument: data.instrument || null,
      marketType: data.marketType || null,
      direction: data.direction || null,
      entry: data.entry || null,
      entryRange: data.entryRange || null,
      stopLoss: data.stopLoss || null,
      targets: Array.isArray(data.targets) ? data.targets : [],
      leverage: data.leverage || null,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
      reason: data.reason || '',
      issues: Array.isArray(data.issues) ? data.issues : [],
    };

    return {
      result: normalized,
      model,
      usage,
      rawResponse,
    };
  }

  return {
    interpret,
  };
}

export default createAiInterpreterService;