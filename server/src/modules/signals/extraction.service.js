/**
 * SyncExc Server — Signal extraction service
 *
 * Coordinates deterministic parsing + AI interpretation and produces a
 * structured candidate with per-field provenance.
 */

import { NotFoundError } from '../../lib/errors.js';
import { extractInstrument, normalizeDirection } from '@syncexc/shared';

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

    const source = await db.query(
      `SELECT * FROM signal_sources WHERE id = $1`,
      [message.source_id]
    );
    const sourceRow = source.rows[0];

    // Step 1: deterministic parser
    const parserResult = await parser.parseMessage(messageId);

    // Step 2: AI interpreter (only if the parser was inconclusive)
    let aiResult = null;
    const parserIncomplete =
      !parserResult ||
      !parserResult.result.instrument ||
      !parserResult.result.direction;

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
        entry: merged.entry,
        entryRange: merged.entryRange,
        stopLoss: merged.stopLoss,
        leverage: merged.leverage,
        status: 'processing',
      });

      // Insert signal fields with provenance
      await queries.insertSignalField(tx, {
        candidateId: created.id,
        fieldName: 'instrument',
        value: merged.instrument,
        provenance: merged.provenance.instrument,
        confidence: merged.confidence.instrument,
      });

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

  function mergeResults({ parser, ai }) {
    const result = {
      isSignal: false,
      instrument: null,
      marketType: null,
      direction: null,
      entry: null,
      entryRange: null,
      stopLoss: null,
      targets: [],
      leverage: null,
      provenance: {},
      confidence: {},
    };

    if (parser) {
      if (parser.instrument) {
        result.instrument = extractInstrument(parser.instrument) || parser.instrument;
        result.provenance.instrument = 'deterministic_parser';
        result.confidence.instrument = 'high';
        result.isSignal = true;
      }
      if (parser.direction) {
        result.direction = normalizeDirection(parser.direction);
        result.provenance.direction = 'deterministic_parser';
        result.confidence.direction = 'high';
      }
      if (parser.entry) {
        result.entry = parser.entry;
        result.provenance.entry = 'deterministic_parser';
        result.confidence.entry = 'high';
      }
      if (parser.entryRange) {
        result.entryRange = parser.entryRange;
        result.provenance.entry = 'deterministic_parser';
        result.confidence.entry = 'high';
      }
      if (parser.stopLoss) {
        result.stopLoss = parser.stopLoss;
        result.provenance.stopLoss = 'deterministic_parser';
        result.confidence.stopLoss = 'high';
      }
      if (parser.targets?.length) {
        result.targets = parser.targets;
        result.provenance.targets = 'deterministic_parser';
        result.confidence.targets = 'high';
      }
      if (parser.leverage) {
        result.leverage = parser.leverage;
        result.provenance.leverage = 'deterministic_parser';
        result.confidence.leverage = 'high';
      }
    }

    if (ai && ai.isSignal) {
      // Fill in missing fields from AI
      if (!result.instrument && ai.instrument) {
        result.instrument = ai.instrument;
        result.provenance.instrument = 'ai_interpreter';
        result.confidence.instrument = ai.confidence > 0.7 ? 'medium' : 'low';
        result.isSignal = true;
      }
      if (!result.direction && ai.direction) {
        result.direction = ai.direction;
        result.provenance.direction = 'ai_interpreter';
        result.confidence.direction = ai.confidence > 0.7 ? 'medium' : 'low';
      }
      if (!result.marketType && ai.marketType) {
        result.marketType = ai.marketType;
        result.provenance.marketType = 'ai_interpreter';
      }
      if (!result.entry && !result.entryRange && ai.entry) {
        result.entry = ai.entry;
        result.provenance.entry = 'ai_interpreter';
        result.confidence.entry = ai.confidence > 0.7 ? 'medium' : 'low';
      }
      if (!result.entry && !result.entryRange && ai.entryRange) {
        result.entryRange = ai.entryRange;
        result.provenance.entry = 'ai_interpreter';
      }
      if (!result.stopLoss && ai.stopLoss) {
        result.stopLoss = ai.stopLoss;
        result.provenance.stopLoss = 'ai_interpreter';
        result.confidence.stopLoss = ai.confidence > 0.7 ? 'medium' : 'low';
      }
      if (!result.targets.length && ai.targets?.length) {
        result.targets = ai.targets;
        result.provenance.targets = 'ai_interpreter';
        result.confidence.targets = ai.confidence > 0.7 ? 'medium' : 'low';
      }
      if (!result.leverage && ai.leverage) {
        result.leverage = ai.leverage;
        result.provenance.leverage = 'ai_interpreter';
        result.confidence.leverage = ai.confidence > 0.7 ? 'medium' : 'low';
      }
    }

    return result;
  }

  async function getCandidate(candidateId) {
    const candidate = await queries.findCandidateById(candidateId);
    if (!candidate) throw new NotFoundError('Candidate');
    const targets = await queries.listTargetsForCandidate(candidateId);
    const issues = await queries.listOpenIssues(candidateId);
    const relationships = await queries.listRelationships(candidateId);
    return { candidate, targets, issues, relationships };
  }

  async function listCandidatesForWorkspace(workspaceId, { status, query, sort, limit, cursor }) {
    return queries.listCandidatesForWorkspace(workspaceId, { status, query, sort, limit, cursor });
  }

  return {
    extractFromMessage,
    getCandidate,
    listCandidatesForWorkspace,
  };
}

export default createExtractionService;