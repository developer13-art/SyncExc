/**
 * SyncExc Server — Comment service
 */

import { NotFoundError, ConflictError, AuthorizationError } from '../../lib/errors.js';

export function createCommentService({ db, queries, events, realtime, logger }) {
  async function createComment({ userId, postId, parentId, content }) {
    if (!content || content.trim().length === 0) {
      throw new ConflictError('Content is required', 'EMPTY_CONTENT');
    }

    const post = await queries.findPostById(postId);
    if (!post) throw new NotFoundError('Post');
    if (!post.allow_comments) throw new ConflictError('Comments are disabled', 'COMMENTS_DISABLED');

    if (parentId) {
      const parent = await queries.findCommentById(parentId);
      if (!parent || parent.post_id !== postId) throw new NotFoundError('Parent comment');
    }

    return db.tx(async (tx) => {
      const comment = await queries.insertComment(tx, {
        postId,
        parentId,
        authorId: userId,
        content,
      });

      await queries.insertCommentVersion(tx, {
        commentId: comment.id,
        version: 1,
        content,
      });

      // Update post engagement count
      const engagement = post.engagement || { reactions: 0, comments: 0, shares: 0 };
      engagement.comments = (engagement.comments || 0) + 1;
      await queries.updatePost(postId, { engagement });

      await events.publish(
        tx,
        'community.comment_posted',
        {
          commentId: comment.id,
          postId,
          authorId: userId,
          postAuthorId: post.author_id,
        },
        {
          actorId: userId,
          resourceType: 'community_comment',
          resourceId: comment.id,
        }
      );

      return comment;
    }).then((comment) => {
      if (realtime) {
        realtime.broadcast(`post:${postId}`, 'community.comment_created', {
          commentId: comment.id,
          postId,
        });
      }
      return comment;
    });
  }

  async function listComments({ postId, limit }) {
    return queries.listCommentsForPost(postId, { limit });
  }

  async function updateComment({ userId, commentId, content }) {
    const comment = await queries.findCommentById(commentId);
    if (!comment) throw new NotFoundError('Comment');
    if (comment.author_id !== userId) throw new AuthorizationError('Not the author');

    if (content.length > 5000) throw new ConflictError('Content too long', 'CONTENT_TOO_LONG');

    return db.tx(async (tx) => {
      const updated = await tx.query(
        `
        UPDATE community_comments
        SET content = $2, current_version = current_version + 1, updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [commentId, content]
      );

      await queries.insertCommentVersion(tx, {
        commentId,
        version: comment.current_version + 1,
        content,
      });

      return updated.rows[0];
    });
  }

  async function deleteComment({ userId, commentId, asAdmin = false }) {
    const comment = await queries.findCommentById(commentId);
    if (!comment) throw new NotFoundError('Comment');
    if (!asAdmin && comment.author_id !== userId) throw new AuthorizationError('Not the author');

    const ok = await queries.softDeleteComment(commentId);
    return { ok };
  }

  return {
    createComment,
    listComments,
    updateComment,
    deleteComment,
  };
}

export default createCommentService;