/**
 * SyncExc Server — Signal extraction service
 *
 * Coordinates deterministic parsing + AI interpretation and produces a
 * structured candidate with per-field provenance.
 */

import { NotFoundError } from '../../lib/errors.js';
import { extractInstrument, normalizeDirection, validatePrice } from '@syncexc/shared';

const REVIEW_LANGUAGE_REGEX =
  /\b(?:cancel(?:led|ed)?|ignore|do not|don't|not a signal|close(?:d)?|exit|update|modify|amend)\b/i;

export function createExtractionService({
  db,
  queries,
  parser,
  aiInterpreter,
  logger,
}) {
  /**
   * Run the extraction pipeline for a message.
   * Returns the created candidate record.
   */
  async function extractFromMessage({ messageId }) {
    const message = await queries.findMessageById(messageId);
    if (!message) throw new NotFoundError('Message');
    const existingCandidate = await queries.findCandidateByMessageId(messageId);
    if (existingCandidate) return { isSignal: true, candidate: existingCandidate, replayed: true };

    const source = await db.query(
      `SELECT * FROM signal_sources WHERE id = $1`,
      [message.source_id]
    );
    const sourceRow = source.rows[0];

    // Step 1: deterministic parser
    const parserResult = await parser.parseMessage(messageId);

    // Step 2: AI interpreter (only if the parser was inconclusive)
    let aiResult = null;
    const requiresReview = REVIEW_LANGUAGE_REGEX.test(message.content);
    const parserIncomplete =
      !parserResult ||
      !parserResult.result.instrument ||
      !parserResult.result.direction ||
      !parserResult.result.marketType ||
      !parserResult.result.orderType ||
      !parserResult.result.entry ||
      !parserResult.result.stopLoss ||
      !parserResult.result.targets?.length ||
      requiresReview;

    if (parserIncomplete && aiInterpreter) {
      try {
        aiResult = await aiInterpreter.interpret({
          messageId,
          content: message.content,
        });
      } catch (err) {
        logger.warn({ err, messageId }, 'AI interpretation failed');
      }
    }

    // Step 3: Merge results — prefer deterministic parser where available
    const merged = mergeResults({
      parser: parserResult?.result,
      ai: aiResult?.result,
      requiresReview,
    });

    if (!merged.isSignal) {
      await queries.updateMessageStatus(messageId, 'rejected');
      return { isSignal: false };
    }

    // Step 4: Create the candidate
    const candidate = await db.tx(async (tx) => {
      const created = await queries.insertCandidate(tx, {
        sourceId: message.source_id,
        messageId,
        instrument: merged.instrument,
        marketType: merged.marketType,
        direction: merged.direction,
        orderType: merged.orderType,
        entry: merged.entry,
        entryRange: merged.entryRange,
        stopLoss: merged.stopLoss,
        leverage: merged.leverage,
        status: 'processing',
      });

      // Insert signal fields with provenance
      for (const fieldName of ['instrument', 'marketType', 'direction', 'orderType']) {
        const value = merged[fieldName];
        if (!value) continue;
        await queries.insertSignalField(tx, {
          candidateId: created.id,
          fieldName: fieldName === 'marketType' ? 'market_type' : fieldName === 'orderType' ? 'order_type' : fieldName,
          value,
          provenance: merged.provenance[fieldName],
          confidence: merged.confidence[fieldName],
        });
      }

      if (merged.entry) {
        await queries.insertSignalField(tx, {
          candidateId: created.id,
          fieldName: 'entry',
          value: merged.entry,
          provenance: merged.provenance.entry,
          confidence: merged.confidence.entry,
        });
      }

      if (merged.entryRange) {
        await queries.insertSignalField(tx, {
          candidateId: created.id,
          fieldName: 'entry_range',
          value: merged.entryRange,
          provenance: merged.provenance.entry,
          confidence: merged.confidence.entry,
        });
      }

      if (merged.stopLoss) {
        await queries.insertSignalField(tx, {
          candidateId: created.id,
          fieldName: 'stop_loss',
          value: merged.stopLoss,
          provenance: merged.provenance.stopLoss,
          confidence: merged.confidence.stopLoss,
        });
      }

      if (merged.leverage) {
        await queries.insertSignalField(tx, {
          candidateId: created.id,
          fieldName: 'leverage',
          value: merged.leverage,
          provenance: merged.provenance.leverage,
          confidence: merged.confidence.leverage,
        });
      }

      // Insert targets
      for (let i = 0; i < merged.targets.length; i += 1) {
        await queries.insertSignalTarget(tx, {
          candidateId: created.id,
          ordinal: i + 1,
          label: `TP${i + 1}`,
          value: merged.targets[i],
        });
      }

      for (const issue of merged.issues) {
        await queries.insertIssue(tx, {
          candidateId: created.id,
          issueType: 'ambiguous_value',
          severity: 'high',
          affectedFields: [],
          evidence: { detail: issue },
          detectionMethod: 'ai_interpreter',
        });
      }

      // Insert version 1
      await queries.insertCandidateVersion(tx, {
        candidateId: created.id,
        version: 1,
        snapshot: created,
      });

      return created;
    });

    // Step 5: Emit for further processing
    await db.tx(async (tx) => {
      await queries.insertProcessingJob(tx, {
        messageId,
        jobType: 'validate',
      });
    });

    await queries.updateMessageStatus(messageId, 'processing');

    return { isSignal: true, candidate };
  }

  function mergeResults({ parser, ai, requiresReview }) {
    const result = {
      isSignal: false,
      instrument: null,
      marketType: null,
      direction: null,
      orderType: null,
      entry: null,
      entryRange: null,
      stopLoss: null,
      targets: [],
      leverage: null,
      issues: requiresReview
        ? ['Message language suggests a signal update, cancellation, or negation and requires review.']
        : [],
      provenance: {},
      confidence: {},
    };

    if (parser) {
      if (parser.instrument) {
        result.instrument = normalizeSignalInstrument(parser.instrument);
        if (result.instrument) {
          result.provenance.instrument = 'deterministic_parser';
          result.confidence.instrument = 'high';
        }
      }
      if (parser.marketType) {
        result.marketType = normalizeMarketType(parser.marketType);
        if (result.marketType) {
          result.provenance.marketType = 'deterministic_parser';
          result.confidence.marketType = 'high';
        }
      }
      if (parser.direction) {
        result.direction = normalizeDirection(parser.direction);
        if (result.direction) {
          result.provenance.direction = 'deterministic_parser';
          result.confidence.direction = 'high';
        }
      }
      if (parser.orderType) {
        result.orderType = normalizeOrderType(parser.orderType);
        if (result.orderType) {
          result.provenance.orderType = 'deterministic_parser';
          result.confidence.orderType = 'high';
        }
      }
      if (parser.entry) {
        result.entry = normalizePrice(parser.entry);
        if (result.entry) {
          result.provenance.entry = 'deterministic_parser';
          result.confidence.entry = 'high';
        }
      }
      if (parser.entryRange) {
        result.entryRange = normalizeEntryRange(parser.entryRange);
        if (result.entryRange) {
          result.provenance.entry = 'deterministic_parser';
          result.confidence.entry = 'high';
        }
      }
      if (parser.stopLoss) {
        result.stopLoss = normalizePrice(parser.stopLoss);
        if (result.stopLoss) {
          result.provenance.stopLoss = 'deterministic_parser';
          result.confidence.stopLoss = 'high';
        }
      }
      if (parser.targets?.length) {
        result.targets = parser.targets.map(normalizePrice).filter(Boolean);
        if (result.targets.length > 0) {
          result.provenance.targets = 'deterministic_parser';
          result.confidence.targets = 'high';
        }
      }
      if (parser.leverage) {
        result.leverage = normalizePrice(parser.leverage);
        if (result.leverage) {
          result.provenance.leverage = 'deterministic_parser';
          result.confidence.leverage = 'high';
        }
      }
    }

    if (ai && !ai.isSignal) {
      result.isSignal = false;
      return result;
    }

    if (ai?.isSignal) {
      result.isSignal = true;
      result.issues = [
        ...result.issues,
        ...(Array.isArray(ai.issues)
          ? ai.issues.filter((issue) => typeof issue === 'string').map((issue) => issue.slice(0, 500))
          : []),
      ];
      if (!Number.isFinite(Number(ai.confidence)) || Number(ai.confidence) < 0.8) {
        result.issues.push('AI extraction confidence is below the automation threshold and requires review.');
      }
      // Fill in missing fields from AI
      if (!result.instrument && ai.instrument) {
        result.instrument = normalizeSignalInstrument(ai.instrument);
        if (result.instrument) {
          result.provenance.instrument = 'ai_interpreter';
          result.confidence.instrument = ai.confidence > 0.7 ? 'medium' : 'low';
        }
        result.isSignal = true;
      }
      if (!result.direction && ai.direction) {
        result.direction = normalizeDirection(ai.direction);
        if (result.direction) {
          result.provenance.direction = 'ai_interpreter';
          result.confidence.direction = ai.confidence > 0.7 ? 'medium' : 'low';
        }
      }
      if (!result.marketType && ai.marketType) {
        result.marketType = normalizeMarketType(ai.marketType);
        if (result.marketType) {
          result.provenance.marketType = 'ai_interpreter';
          result.confidence.marketType = ai.confidence > 0.7 ? 'medium' : 'low';
        }
      }
      if (!result.orderType && ai.orderType) {
        result.orderType = normalizeOrderType(ai.orderType);
        if (result.orderType) {
          result.provenance.orderType = 'ai_interpreter';
          result.confidence.orderType = ai.confidence > 0.7 ? 'medium' : 'low';
        }
      }
      if (!result.entry && !result.entryRange && ai.entry) {
        result.entry = normalizePrice(ai.entry);
        if (result.entry) {
          result.provenance.entry = 'ai_interpreter';
          result.confidence.entry = ai.confidence > 0.7 ? 'medium' : 'low';
        }
      }
      if (!result.entry && !result.entryRange && ai.entryRange) {
        result.entryRange = normalizeEntryRange(ai.entryRange);
        if (result.entryRange) {
          result.provenance.entry = 'ai_interpreter';
          result.confidence.entry = ai.confidence > 0.7 ? 'medium' : 'low';
        }
      }
      if (!result.stopLoss && ai.stopLoss) {
        result.stopLoss = normalizePrice(ai.stopLoss);
        if (result.stopLoss) {
          result.provenance.stopLoss = 'ai_interpreter';
          result.confidence.stopLoss = ai.confidence > 0.7 ? 'medium' : 'low';
        }
      }
      if (!result.targets.length && ai.targets?.length) {
        result.targets = ai.targets.map(normalizePrice).filter(Boolean);
        if (result.targets.length > 0) {
          result.provenance.targets = 'ai_interpreter';
          result.confidence.targets = ai.confidence > 0.7 ? 'medium' : 'low';
        }
      }
      if (!result.leverage && ai.leverage) {
        result.leverage = normalizePrice(ai.leverage);
        if (result.leverage) {
          result.provenance.leverage = 'ai_interpreter';
          result.confidence.leverage = ai.confidence > 0.7 ? 'medium' : 'low';
        }
      }
    }

    if (!ai) result.isSignal = Boolean(result.instrument && result.direction);
    return result;
  }

  function normalizeSignalInstrument(value) {
    const instrument = extractInstrument(value);
    if (!instrument) return null;
    return instrument.toUpperCase().replace(/[/:_-]/g, '');
  }

  function normalizePrice(value) {
    const price = String(value ?? '').trim();
    return validatePrice(price).valid ? price : null;
  }

  function normalizeEntryRange(value) {
    const min = normalizePrice(value?.min);
    const max = normalizePrice(value?.max);
    if (!min || !max || Number(min) > Number(max)) return null;
    return { min, max };
  }

  function normalizeOrderType(value) {
    const orderType = String(value || '').toLowerCase();
    return ['market', 'limit'].includes(orderType) ? orderType : null;
  }

  function normalizeMarketType(value) {
    const marketType = String(value || '').toLowerCase();
    return ['futures', 'perpetual'].includes(marketType) ? 'futures' : marketType === 'spot' ? 'spot' : null;
  }

  async function getCandidate(candidateId) {
    const candidate = await queries.findCandidateById(candidateId);
    if (!candidate) throw new NotFoundError('Candidate');
    const targets = await queries.listTargetsForCandidate(candidateId);
    const issues = await queries.listOpenIssues(candidateId);
    const relationships = await queries.listRelationships(candidateId);
    return { candidate, targets, issues, relationships };
  }

  async function listCandidatesForWorkspace(workspaceId, { status, sourceId, query, sort, limit, cursor }) {
    return queries.listCandidatesForWorkspace(workspaceId, { status, sourceId, query, sort, limit, cursor });
  }

  return {
    extractFromMessage,
    getCandidate,
    listCandidatesForWorkspace,
  };
}

export default createExtractionService;