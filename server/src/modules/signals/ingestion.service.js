/**
 * SyncExc Server — Signal message ingestion
 */

import { createHash } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';

export function createIngestionService({ db, queries, deduplication, events, sourceAccess, logger }) {
  async function ingestMessage({
    workspaceId,
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
    if (!workspaceId) throw new ValidationError('workspaceId is required');

    const source = await sourceAccess.getSourceForWorkspace({ sourceId, workspaceId });
    if (source.workspace_id !== workspaceId) throw new NotFoundError('Source');
    const connectionResult = await db.query(
      `
      SELECT sc.status, sc.authorization_status, w.status AS workspace_status
      FROM signal_source_connections sc
      JOIN signal_sources s ON s.id = sc.source_id
      JOIN workspaces w ON w.id = s.workspace_id
      WHERE sc.source_id = $1
      ORDER BY sc.created_at DESC
      LIMIT 1
      `,
      [sourceId]
    );
    const connection = connectionResult.rows[0];
    if (connection?.workspace_status !== 'active' ||
        source.status !== 'active' || !source.monitoring_enabled ||
        connection?.status !== 'active' || connection.authorization_status !== 'authorized') {
      throw new ConflictError('Source monitoring is not active for this workspace', 'SOURCE_MONITORING_DISABLED');
    }

    const contentHash = createHash('sha256').update(content).digest('hex');
    const normalizedProviderMessageId = providerMessageId || `sha256:${createHash('sha256')
      .update(`${sourceId}\u0000${channelRef || ''}\u0000${providerTimestamp || ''}\u0000${contentHash}`)
      .digest('hex')}`;

    // 1. Insert the message (idempotent on provider_message_id)
    const message = await db.tx(async (tx) => {
      const inserted = await queries.insertMessage(tx, {
        sourceId,
        providerMessageId: normalizedProviderMessageId,
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
          workspaceId,
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
    const source = await sourceAccess.getSourceForWorkspace({ sourceId: message.source_id, workspaceId });
    if (source.workspace_id !== workspaceId) throw new NotFoundError('Message');
    return message;
  }

  async function listMessagesForSource({ sourceId, workspaceId, limit }) {
    const source = await sourceAccess.getSourceForWorkspace({ sourceId, workspaceId });
    if (source.workspace_id !== workspaceId) throw new NotFoundError('Source');
    return queries.listMessagesForSource(sourceId, { limit });
  }

  return {
    ingestMessage,
    getMessage,
    listMessagesForSource,
  };
}

export default createIngestionService;