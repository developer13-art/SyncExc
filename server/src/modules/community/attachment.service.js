import path from 'node:path';
import { AuthorizationError, NotFoundError, ValidationError } from '../../lib/errors.js';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['application/pdf', 'pdf'],
  ['text/plain', 'txt'],
  ['text/csv', 'csv'],
]);

export function createCommunityAttachmentService({
  db,
  queries,
  storage,
  postService,
  commentService,
  messagingService,
  discussionService,
}) {
  async function upload({ userId, file }) {
    if (!file?.buffer?.length) throw new ValidationError('File is empty');
    if (file.buffer.length > MAX_FILE_SIZE) {
      throw new ValidationError('File exceeds the 25 MB limit');
    }
    const extension = ALLOWED_TYPES.get(file.mimetype);
    if (!extension) throw new ValidationError('Unsupported file type');
    validateFileSignature(file.buffer, file.mimetype);

    const stored = await storage.put({
      buffer: file.buffer,
      mimeType: file.mimetype,
      extension,
    });
    try {
      const result = await db.query(
        `INSERT INTO community_attachments
           (uploader_id, storage_key, file_name, mime_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, file_name, mime_type, size_bytes, created_at`,
        [
          userId,
          stored.key,
          sanitizeFileName(file.originalname),
          file.mimetype,
          file.buffer.length,
        ]
      );
      return serializeAttachment(result.rows[0]);
    } catch (error) {
      await storage.delete(stored.key);
      throw error;
    }
  }

  async function attach(client, { userId, attachmentIds = [], resourceType, resourceId }) {
    if (!attachmentIds.length) return [];
    const rows = await queries.attachFiles(client, {
      userId,
      attachmentIds,
      resourceType,
      resourceId,
    });
    if (rows.length !== attachmentIds.length) {
      throw new AuthorizationError('One or more attachments are invalid or already used');
    }
    return rows.map(serializeAttachment);
  }

  async function list(resourceType, resourceId) {
    return (await queries.listFiles(resourceType, resourceId)).map(serializeAttachment);
  }

  async function download({
    userId,
    attachmentId,
    postService,
    commentService,
    messagingService,
    discussionService,
  }) {
    const attachment = await queries.findFile(attachmentId);
    if (!attachment) throw new NotFoundError('Attachment');
    if (!attachment.resource_id) {
      if (attachment.uploader_id !== userId) throw new NotFoundError('Attachment');
    } else {
      await authorizeResource(userId, attachment, {
        postService,
        commentService,
        messagingService,
        discussionService,
      });
    }
    const buffer = await storage.get(attachment.storage_key);
    if (!buffer) throw new NotFoundError('Attachment file');
    return {
      buffer,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
    };
  }

  async function deletePending({ userId, attachmentId }) {
    const attachment = await queries.deletePendingFile(attachmentId, userId);
    if (!attachment) throw new NotFoundError('Attachment');
    await storage.delete(attachment.storage_key);
    return { ok: true };
  }

  async function authorizeResource(userId, attachment, services) {
    switch (attachment.resource_type) {
      case 'post':
        await services.postService.getPost({ postId: attachment.resource_id, viewerId: userId });
        return;
      case 'comment': {
        const comment = await services.commentService.getComment(attachment.resource_id);
        await services.postService.getPost({ postId: comment.post_id, viewerId: userId });
        return;
      }
      case 'direct_message':
        await services.messagingService.assertCanAccessMessage({
          userId,
          messageId: attachment.resource_id,
        });
        return;
      case 'discussion_message':
        await services.discussionService.assertCanAccessMessage(attachment.resource_id);
        return;
      default:
        throw new NotFoundError('Attachment');
    }
  }

  return { upload, attach, list, download, deletePending, MAX_FILE_SIZE, ALLOWED_TYPES };
}

function validateFileSignature(buffer, mimeType) {
  const prefix = buffer.subarray(0, 12);
  const valid =
    (mimeType === 'image/png' && prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mimeType === 'image/jpeg' && prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff) ||
    (mimeType === 'image/webp' && prefix.toString('ascii', 0, 4) === 'RIFF' && prefix.toString('ascii', 8, 12) === 'WEBP') ||
    (mimeType === 'application/pdf' && prefix.toString('ascii', 0, 5) === '%PDF-') ||
    (['text/plain', 'text/csv'].includes(mimeType) && !buffer.includes(0));
  if (!valid) throw new ValidationError('File contents do not match the selected file type');
}

function sanitizeFileName(fileName) {
  const normalized = String(fileName || 'attachment').replace(/\\/g, '/');
  const name = path.basename(normalized).replace(/[\r\n"]/g, '').slice(0, 255);
  return name || 'attachment';
}

function serializeAttachment(row) {
  return {
    id: row.id,
    name: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    url: `/api/v1/community/attachments/${row.id}`,
    createdAt: row.created_at,
  };
}

export default createCommunityAttachmentService;
