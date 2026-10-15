/**
 * SyncExc Server — Bookmark service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createBookmarkService({ db, queries, logger }) {
  async function addBookmark({ userId, resourceType, resourceId, collection, note }) {
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

  async function listBookmarks({ userId, limit }) {
    return queries.listBookmarks(userId, { limit });
  }

  return {
    addBookmark,
    removeBookmark,
    listBookmarks,
  };
}

export default createBookmarkService;