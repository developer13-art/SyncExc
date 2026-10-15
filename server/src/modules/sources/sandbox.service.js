/**
 * SyncExc Server — Sandbox testing service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createSandboxService({ db, queries, adapterRegistry, logger }) {
  /**
   * Run a sandbox test: fetch a sample of messages, run them through the
   * parser, return the results without side effects.
   */
  async function testParsing({ sourceId, workspaceId, sampleSize = 10 }) {
    const source = await queries.findSourceById(sourceId);
    if (!source || source.workspace_id !== workspaceId) throw new NotFoundError('Source');

    const connection = await queries.findSourceConnection(sourceId);
    const adapter = adapterRegistry.get(source.type);
    if (!adapter) throw new NotFoundError(`Adapter for ${source.type}`);

    // Fetch sample messages from the adapter
    let messages = [];
    try {
      messages = await adapter.fetchSampleMessages({
        source,
        connection,
        limit: sampleSize,
      });
    } catch (err) {
      logger.warn({ err, sourceId }, 'Sandbox fetch failed');
      return { ok: false, error: err.message, messages: [], parsed: [] };
    }

    // Run each message through the parser
    const parsed = [];
    for (const message of messages) {
      try {
        const result = await adapter.parseMessage(message);
        parsed.push({
          messageId: message.id,
          raw: message,
          parsed: result,
          success: true,
        });
      } catch (err) {
        parsed.push({
          messageId: message.id,
          raw: message,
          parsed: null,
          success: false,
          error: err.message,
        });
      }
    }

    return {
      ok: true,
      sampleSize: messages.length,
      parsed,
    };
  }

  return {
    testParsing,
  };
}

export default createSandboxService;