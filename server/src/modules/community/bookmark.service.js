/**
 * SyncExc Server — Bookmark service
 */

import { NotFoundError, AuthorizationError } from '../../lib/errors.js';
import { serializePost } from '../../lib/serializers.js';

export function createBookmarkService({
  db,
  queries,
  postService,
  analysisService,
  groupService,
  logger,
}) {
  async function assertResourceVisible({ userId, resourceType, resourceId, workspaceId = null }) {
    if (resourceType === 'post') {
      await postService.getPost({ postId: resourceId, viewerId: userId, workspaceId });
      return;
    }
    if (resourceType === 'comment') {
      const comment = await queries.findCommentById(resourceId);
      if (!comment) throw new NotFoundError('Comment');
      await postService.getPost({ postId: comment.post_id, viewerId: userId, workspaceId });
      return;
    }
    if (resourceType === 'analysis') {
      await analysisService.getDocument({ documentId: resourceId, viewerId: userId, workspaceId });
      return;
    }
    if (resourceType === 'group') {
      await groupService.getGroup({ groupId: resourceId, viewerId: userId });
      return;
    }
    throw new NotFoundError('Resource');
  }

  async function addBookmark({ userId, resourceType, resourceId, collection, note, workspaceId }) {
    await assertResourceVisible({ userId, resourceType, resourceId, workspaceId });
    return db.tx(async (tx) => {
      return queries.insertBookmark(tx, {
        userId,
        resourceType,
        resourceId,
        collection,
        note,
      });
    });
  }

  async function removeBookmark({ userId, bookmarkId }) {
    const ok = await queries.removeBookmark(userId, bookmarkId);
    if (!ok) throw new NotFoundError('Bookmark');
    return { ok: true };
  }

  async function listBookmarks({ userId, limit, workspaceId }) {
    const bookmarks = await queries.listBookmarks(userId, { limit });
    return Promise.all(bookmarks.map(async (bookmark) => {
      const item = {
        id: bookmark.id,
        resourceType: bookmark.resource_type,
        resourceId: bookmark.resource_id,
        collection: bookmark.collection,
        note: bookmark.note,
        createdAt: bookmark.created_at,
      };
      if (bookmark.resource_type !== 'post') return { ...item, post: null };

      try {
        const result = await postService.getPost({
          postId: bookmark.resource_id,
          viewerId: userId,
          workspaceId,
        });
        return {
          ...item,
          post: serializePost({
            ...result.post,
            reaction_count: result.reactionsCount,
          }),
        };
      } catch (error) {
        if (error instanceof NotFoundError || error instanceof AuthorizationError) {
          return { ...item, post: null };
        }
        throw error;
      }
    }));
  }

  return {
    addBookmark,
    removeBookmark,
    listBookmarks,
  };
}

export default createBookmarkService;