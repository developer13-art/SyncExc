/**
 * SyncExc Server — Attachment service
 *
 * Handles secure attachment upload, validation, and scanning. Files are
 * stored via the storage driver (local or S3). Scan state is tracked on
 * the record.
 */

import { createHash } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../lib/errors.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
]);

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB

export function createAttachmentService({ db, queries, storage, events, logger }) {
  async function uploadAttachment({
    userId,
    ticketId,
    messageId,
    fileName,
    mimeType,
    buffer,
  }) {
    if (!buffer || buffer.length === 0) {
      throw new ValidationError('File is empty');
    }
    if (buffer.length > MAX_ATTACHMENT_SIZE) {
      throw new ValidationError(`File exceeds ${MAX_ATTACHMENT_SIZE / 1024 / 1024} MB`);
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new ValidationError(`Unsupported file type: ${mimeType}`);
    }

    const contentHash = createHash('sha256').update(buffer).digest('hex');
    const extension = getExtension(mimeType);

    // Store the file
    const stored = await storage.put({
      buffer,
      mimeType,
      extension,
    });

    // Immediately scan (real implementation invokes malware scanner)
    const scanResult = await scanFile({ buffer, mimeType, fileName });

    return db.tx(async (tx) => {
      const attachment = await queries.insertAttachment(tx, {
        ticketId,
        messageId,
        uploaderId: userId,
        storageKey: stored.key,
        fileName,
        mimeType,
        sizeBytes: buffer.length,
        contentHash,
        scanState: scanResult.clean ? 'clean' : 'infected',
      });

      if (!scanResult.clean) {
        await queries.updateAttachmentScanState(attachment.id, 'infected', scanResult);
        logger.warn(
          { attachmentId: attachment.id, fileName },
          'Attachment flagged by scanner'
        );
      }

      return attachment;
    });
  }

  /**
   * Basic content inspection. In production this delegates to ClamAV or a
   * managed scanner; here we reject obvious executable payloads by content
   * magic and size.
   */
  async function scanFile({ buffer, mimeType, fileName }) {
    // Reject executable signatures
    const head = buffer.slice(0, 4).toString('hex');
    const executableSignatures = new Set(['7f454c46', '4d5a9000']); // ELF, PE
    if (executableSignatures.has(head)) {
      return { clean: false, reason: 'executable_signature' };
    }

    // Reject scripts disguised as other types
    const firstBytes = buffer.slice(0, 20).toString('utf8').toLowerCase();
    if (firstBytes.startsWith('#!/') || firstBytes.includes('<?php')) {
      return { clean: false, reason: 'script_signature' };
    }

    return { clean: true };
  }

  function getExtension(mimeType) {
    const map = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'application/json': 'json',
    };
    return map[mimeType] || 'bin';
  }

  async function listAttachments({ ticketId, userId, asAgent }) {
    await requireTicketAccess({ ticketId, userId, asAgent });
    return queries.listAttachments(ticketId);
  }

  async function getAttachmentDownload({ attachmentId, userId, asAgent }) {
    const attachment = await queries.findAttachmentById(attachmentId);
    if (!attachment) throw new NotFoundError('Attachment');

    await requireTicketAccess({ ticketId: attachment.ticket_id, userId, asAgent });

    // Fetch from storage
    const buffer = await storage.get(attachment.storage_key);
    if (!buffer) throw new NotFoundError('File');

    // Audit
    await db.tx(async (tx) => {
      await queries.insertAuditEvent(tx, {
        actorId: userId,
        ticketId: attachment.ticket_id,
        action: 'attachment.downloaded',
        resourceType: 'support_attachment',
        resourceId: attachmentId,
      });
    });

    return {
      buffer,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
    };
  }

  async function removeAttachment({ userId, attachmentId, asAgent }) {
    const attachment = await queries.findAttachmentById(attachmentId);
    if (!attachment) throw new NotFoundError('Attachment');

    const ticket = await requireTicketAccess({
      ticketId: attachment.ticket_id,
      userId,
      asAgent,
    });

    // Only uploader or agent can remove
    if (!asAgent && attachment.uploader_id !== userId) {
      throw new NotFoundError('Attachment');
    }

    await storage.delete(attachment.storage_key);
    await db.query(`DELETE FROM support_ticket_attachments WHERE id = $1`, [attachmentId]);

    return { ok: true };
  }

  async function requireTicketAccess({ ticketId, userId, asAgent }) {
    const ticket = await db.query(
      `SELECT * FROM support_tickets WHERE id = $1`,
      [ticketId]
    );
    if (ticket.rows.length === 0) throw new NotFoundError('Ticket');
    const t = ticket.rows[0];

    if (asAgent) return t;
    if (t.requester_id !== userId) throw new NotFoundError('Ticket');
    return t;
  }

  return {
    uploadAttachment,
    listAttachments,
    getAttachmentDownload,
    removeAttachment,
    ALLOWED_MIME_TYPES,
    MAX_ATTACHMENT_SIZE,
  };
}

export default createAttachmentService;