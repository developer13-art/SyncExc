import { NotFoundError, ValidationError } from '../../lib/errors.js';
import path from 'node:path';

const MAX_PROOF_SIZE = 5 * 1024 * 1024;

export function createSignalDiscussionService({ queries }) {
  async function requireAccess(signalId, userId) {
    if (!await queries.canAccessSignalDiscussion(signalId, userId)) {
      throw new NotFoundError('Signal discussion');
    }
  }

  async function list({ signalId, userId }) {
    await requireAccess(signalId, userId);
    return queries.listSignalComments(signalId);
  }

  async function create({ signalId, userId, content = '', file }) {
    await requireAccess(signalId, userId);
    const normalizedContent = content.trim();
    if (!normalizedContent && !file) {
      throw new ValidationError('Write a comment or attach a winnings image');
    }
    if (normalizedContent.length > 5000) {
      throw new ValidationError('Comment must not exceed 5,000 characters');
    }

    const proof = file ? validateProof(file) : null;
    return queries.insertSignalComment({
      signalId,
      userId,
      content: normalizedContent,
      proofData: proof?.buffer ?? null,
      proofName: proof?.name ?? null,
      proofMimeType: proof?.mimeType ?? null,
    });
  }

  async function getProof({ commentId, userId }) {
    const comment = await queries.findSignalComment(commentId);
    if (!comment) throw new NotFoundError('Signal comment');
    await requireAccess(comment.signal_id, userId);
    if (!comment.proof_data) throw new NotFoundError('Winnings image');
    return {
      buffer: comment.proof_data,
      fileName: comment.proof_name,
      mimeType: comment.proof_mime_type,
    };
  }

  return { list, create, getProof };
}

function validateProof(file) {
  if (!file?.buffer?.length) throw new ValidationError('Winnings image is empty');
  if (file.buffer.length > MAX_PROOF_SIZE) {
    throw new ValidationError('Winnings image must be 5 MB or smaller');
  }

  const prefix = file.buffer.subarray(0, 12);
  const valid = (
    (file.mimetype === 'image/jpeg' && prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff)
    || (file.mimetype === 'image/png' && prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    || (file.mimetype === 'image/webp' && prefix.toString('ascii', 0, 4) === 'RIFF' && prefix.toString('ascii', 8, 12) === 'WEBP')
  );
  if (!valid) throw new ValidationError('Winnings proof must be a valid JPEG, PNG, or WebP image');

  const name = path.basename(String(file.originalname || 'winnings-proof').replace(/\\/g, '/'))
    .replace(/[\r\n"]/g, '')
    .slice(0, 255) || 'winnings-proof';
  return { buffer: file.buffer, mimeType: file.mimetype, name };
}

export default createSignalDiscussionService;
