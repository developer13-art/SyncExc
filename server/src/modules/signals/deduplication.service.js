/**
 * SyncExc Server — Signal deduplication
 *
 * Distinguishes repeated delivery of the same message from a genuinely new
 * message or a meaningful edit.
 */

import { fnv1aHash } from '@syncexc/shared';

export function createDeduplicationService({ db, queries, logger }) {
  /**
   * Check whether this content has been seen before, and record it.
   */
  async function checkAndRecord({ sourceId, contentHash, messageId }) {
    const dedupKey = `content:${sourceId}:${contentHash}`;

    const existing = await queries.findDedupKey(dedupKey);
    if (existing) {
      // Verify it wasn't the same message we just inserted
      if (existing.message_id === messageId) {
        return { isDuplicate: false };
      }

      return {
        isDuplicate: true,
        reason: 'same_content_same_source',
        originalMessageId: existing.message_id,
      };
    }

    await db.tx(async (tx) => {
      await queries.insertDedupKey(tx, {
        dedupKey,
        scope: `source:${sourceId}`,
        messageId,
        decision: 'unique',
      });
    });

    return { isDuplicate: false };
  }

  /**
   * Detect if a message is a near-duplicate of a recent message (edit).
   */
  async function detectEdit({ sourceId, content, messageId }) {
    // In production this would use similarity search on recent messages.
    // For now, we check exact hash collisions only.
    return { isEdit: false };
  }

  return {
    checkAndRecord,
    detectEdit,
  };
}

export default createDeduplicationService;