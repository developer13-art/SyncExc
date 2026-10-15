/**
 * SyncExc Server — Signal message ingestion
 */

import { createHash } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../lib/errors.js';

export function createIngestionService({ db, queries, deduplication, events, logger }) {
  async function ingestMessage({
    sourceId,
    providerMessageId,
    channelRef,
    providerTimestamp,
    contentType,
    content,
    attachments,
  }) {
    if (!sourceId || !content) {
      throw new ValidationError('sourceId and content are required');
    }

    const contentHash = createHash('sha256').update(content).digest('hex');

    // 1. Insert the message (idempotent on provider_message_id)
    const message = await db.tx(async (tx) => {
      const inserted = await queries.insertMessage(tx, {
        sourceId,
        providerMessageId,
        channelRef,
        providerTimestamp: providerTimestamp || new Date(),
        contentType: contentType || 'text',
        content,
        contentHash,
        metadata: { attachments },
      });

      if (!inserted) {
        // Duplicate provider message — return existing
        const existing = await queries.findMessageByHash(sourceId, contentHash);
        return existing;
      }

      // Insert version 1
      await queries.insertMessageVersion(tx, {
        messageId: inserted.id,
        version: 1,
        content,
        contentHash,
        changeReason: 'initial',
      });

      return inserted;
    });

    if (!message) {
      logger.debug({ sourceId, providerMessageId }, 'Duplicate message ignored');
      return { duplicate: true };
    }

    // 2. Check for content-hash duplicates across sources
    const dedupResult = await deduplication.checkAndRecord({
      sourceId,
      contentHash,
      messageId: message.id,
    });

    if (dedupResult.isDuplicate) {
      await queries.updateMessageStatus(message.id, 'duplicated');
      return { message, duplicate: true, reason: dedupResult.reason };
    }

    // 3. Emit for parsing
    await db.tx(async (tx) => {
      const job = await queries.insertProcessingJob(tx, {
        messageId: message.id,
        jobType: 'parse',
      });

      await events.publish(
        tx,
        'signal.message_received',
        {
          messageId: message.id,
          sourceId,
          jobId: job.id,
          contentHash,
        },
        {
          workspaceId: null,
          resourceType: 'signal_message',
          resourceId: message.id,
        }
      );
    });

    return { message, duplicate: false };
  }

  async function getMessage({ messageId, workspaceId }) {
    const message = await queries.findMessageById(messageId);
    if (!message) throw new NotFoundError('Message');
    // Caller should verify source ownership
    return message;
  }

  async function listMessagesForSource({ sourceId, limit }) {
    return queries.listMessagesForSource(sourceId, { limit });
  }

  return {
    ingestMessage,
    getMessage,
    listMessagesForSource,
  };
}

export default createIngestionService;