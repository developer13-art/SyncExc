/**
 * SyncExc Server — Post service
 */

import { NotFoundError, ConflictError, AuthorizationError } from '../../lib/errors.js';

export function createPostService({ db, queries, events, realtime, logger }) {
  async function createPost({
    userId,
    destinationType,
    destinationRefId,
    content,
    topics,
    attachments,
    visibility,
    allowComments,
  }) {
    if (!content || content.trim().length === 0) {
      throw new ConflictError('Content is required', 'EMPTY_CONTENT');
    }
    if (content.length > 10000) {
      throw new ConflictError('Content exceeds maximum length', 'CONTENT_TOO_LONG');
    }

    // Verify membership for group/workspace destinations
    if (destinationType === 'group') {
      const membership = await queries.findGroupMembership(destinationRefId, userId);
      if (!membership || membership.state !== 'active') {
        throw new AuthorizationError('Not a member of this group', 'NOT_MEMBER');
      }
    }

    return db.tx(async (tx) => {
      const post = await queries.insertPost(tx, {
        authorId: userId,
        destinationType,
        destinationRefId,
        content,
        topics,
        visibility,
        allowComments,
      });

      await queries.insertPostVersion(tx, {
        postId: post.id,
        version: 1,
        content,
      });

      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          await queries.insertPostAttachment(tx, {
            postId: post.id,
            type: attachment.type,
            storageKey: attachment.storageKey,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
          });
        }
      }

      await events.publish(
        tx,
        'community.post_published',
        {
          postId: post.id,
          authorId: userId,
          destinationType,
          destinationRefId,
        },
        {
          actorId: userId,
          resourceType: 'community_post',
          resourceId: post.id,
        }
      );

      return post;
    }).then((post) => {
      // Broadcast to feed subscribers
      if (realtime && destinationType === 'public_feed') {
        realtime.broadcast(`feed:public`, 'community.post_published', {
          postId: post.id,
          authorId: userId,
        });
      }
      return post;
    });
  }

  async function updatePost({ userId, postId, content, topics, allowComments }) {
    const post = await queries.findPostById(postId);
    if (!post) throw new NotFoundError('Post');
    if (post.author_id !== userId) throw new AuthorizationError('Not the author');

    return db.tx(async (tx) => {
      const updated = await queries.updatePost(postId, {
        content,
        topics,
        allowComments,
      });

      await queries.insertPostVersion(tx, {
        postId,
        version: post.current_version + 1,
        content,
      });

      return updated;
    });
  }

  async function deletePost({ userId, postId, asAdmin = false }) {
    const post = await queries.findPostById(postId);
    if (!post) throw new NotFoundError('Post');
    if (!asAdmin && post.author_id !== userId) throw new AuthorizationError('Not the author');

    const ok = await queries.softDeletePost(postId);
    return { ok };
  }

  async function getPost({ postId, viewerId = null }) {
    const post = await queries.findPostById(postId);
    if (!post) throw new NotFoundError('Post');

    // Visibility check
    if (post.visibility !== 'public' && post.author_id !== viewerId) {
      if (post.visibility === 'followers') {
        const isFollowing = await queries.isFollowing(viewerId, post.author_id);
        if (!isFollowing) throw new AuthorizationError('Not permitted');
      }
    }

    const attachments = await queries.listPostAttachments(postId);
    const reactionsCount = await queries.countReactions('post', postId);

    return { post, attachments, reactionsCount };
  }

  async function listFeed({ userId, followingOnly, limit, cursor }) {
    return queries.listFeedPosts({ userId, followingOnly, limit, cursor });
  }

  async function listPostsByAuthor({ authorId, viewerId, limit, cursor }) {
    return queries.listPostsByAuthor({ authorId, viewerId, limit, cursor });
  }

  async function addAttachment({ userId, postId, attachment }) {
    const post = await queries.findPostById(postId);
    if (!post) throw new NotFoundError('Post');
    if (post.author_id !== userId) throw new AuthorizationError('Not the author');

    return db.tx(async (tx) => {
      return queries.insertPostAttachment(tx, {
        postId,
        type: attachment.type,
        storageKey: attachment.storageKey,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      });
    });
  }

  return {
    createPost,
    updatePost,
    deletePost,
    getPost,
    listFeed,
    listPostsByAuthor,
    addAttachment,
  };
}

export default createPostService;