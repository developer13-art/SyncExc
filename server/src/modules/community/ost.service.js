/**
 * SyncExc Server — Post service
 */

import { NotFoundError, ConflictError, AuthorizationError } from '../../lib/errors.js';

export function createPostService({ db, queries, events, realtime, logger }) {
  async function createPost({
    userId,
    workspaceId = null,
    destinationType,
    destinationRefId,
    content,
    topics,
    attachments,
    visibility,
    allowComments,
    poll,
    event,
    marketIdea,
  }) {
    if (!content || content.trim().length === 0) {
      throw new ConflictError('Content is required', 'EMPTY_CONTENT');
    }
    if (content.length > 10000) {
      throw new ConflictError('Content exceeds maximum length', 'CONTENT_TOO_LONG');
    }
    if ([poll, event, marketIdea].filter(Boolean).length > 1) {
      throw new ConflictError('A post can contain only one structured content type');
    }

    // Verify membership for group/workspace destinations
    if (destinationType === 'group') {
      const membership = await queries.findGroupMembership(destinationRefId, userId);
      if (!membership || membership.state !== 'active') {
        throw new AuthorizationError('Not a member of this group', 'NOT_MEMBER');
      }
    }
    if (
      destinationType === 'workspace_discussion' &&
      (!workspaceId || destinationRefId !== workspaceId)
    ) {
      throw new AuthorizationError('Posts must target the active workspace', 'WORKSPACE_REQUIRED');
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

      if (poll) {
        const record = await queries.insertPostPoll(tx, {
          postId: post.id,
          question: poll.question,
          allowMultiple: Boolean(poll.allowMultiple),
          closesAt: poll.closesAt,
        });
        for (const [position, label] of poll.options.entries()) {
          await queries.insertPollOption(tx, {
            postId: record.post_id,
            position,
            label,
          });
        }
      } else if (event) {
        await queries.insertPostEvent(tx, { postId: post.id, ...event });
      } else if (marketIdea) {
        await queries.insertMarketIdea(tx, { postId: post.id, ...marketIdea });
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
      const hasContentUpdate = content !== undefined;
      const nextVersion = hasContentUpdate
        ? (post.current_version || 1) + 1
        : post.current_version || 1;
      const updated = await queries.updatePost(postId, {
        content,
        topics,
        allowComments,
        currentVersion: nextVersion,
      }, tx);

      if (hasContentUpdate) {
        await queries.insertPostVersion(tx, {
          postId,
          version: nextVersion,
          content,
        });
      }

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

  async function getPost({ postId, viewerId = null, workspaceId = null }) {
    const post = await queries.findPostById(postId);
    if (!post) throw new NotFoundError('Post');

    const isAuthor = viewerId === post.author_id;
    if (!isAuthor) {
      if (viewerId) {
        const blocked =
          (await queries.isBlocked(viewerId, post.author_id)) ||
          (await queries.isBlocked(post.author_id, viewerId));
        if (blocked) throw new AuthorizationError('Post is not available');
      }

      const authorProfile = await queries.findProfileByUserId(post.author_id);
      const authorVisibility = authorProfile?.visibility ?? post.author_visibility ?? 'public';
      if (['group_members', 'workspace_members'].includes(authorVisibility)) {
        throw new AuthorizationError('Post is not available');
      }
      if (['followers', 'private'].includes(authorVisibility)) {
        const followsAuthor = viewerId
          ? await queries.isFollowing(viewerId, post.author_id)
          : false;
        if (!followsAuthor) throw new AuthorizationError('Post is not available');
      }

      if (post.destination_type === 'group') {
        const group = await queries.findGroupById(post.destination_ref_id);
        const membership = viewerId
          ? await queries.findGroupMembership(post.destination_ref_id, viewerId)
          : null;
        const isMember = membership?.state === 'active';
        if (group?.type !== 'public' && !isMember) {
          throw new AuthorizationError('Post is not available');
        }
        if (post.visibility === 'public' && group?.type === 'public') {
          // Public posts in public groups can be read without membership.
        } else if (!isMember) {
          throw new AuthorizationError('Post is not available');
        }
      } else if (
        post.destination_type === 'workspace_discussion' &&
        post.visibility === 'workspace_members' &&
        post.destination_ref_id === workspaceId
      ) {
        // The active workspace was validated by the request middleware.
      } else if (post.destination_type !== 'public_feed') {
        throw new AuthorizationError('Post is not available');
      }

      if (post.visibility === 'followers') {
        const isFollowing = viewerId
          ? await queries.isFollowing(viewerId, post.author_id)
          : false;
        if (!isFollowing) throw new AuthorizationError('Post is not available');
      } else if (post.visibility !== 'public' && post.visibility !== 'group_members') {
        throw new AuthorizationError('Post is not available');
      } else if (post.visibility === 'group_members' && post.destination_type !== 'group') {
        throw new AuthorizationError('Post is not available');
      }
    }

    const attachments = await queries.listPostAttachments(postId);
    const reactionsCount = await queries.countReactions('post', postId);
    const viewerReaction = await queries.hasReaction(viewerId, 'post', postId);
    const bookmark = await queries.findPostBookmark(viewerId, postId);
    const poll = await queries.getPollForPost(postId, viewerId);
    const event = await queries.getEventForPost(postId, viewerId);
    const marketIdea = await queries.getMarketIdeaForPost(postId);

    return {
      post: {
        ...post,
        viewer_reaction: viewerReaction ? post.viewer_reaction || 'like' : null,
        bookmark_id: bookmark?.id || null,
        poll,
        event,
        market_idea: marketIdea,
      },
      attachments,
      reactionsCount,
    };
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