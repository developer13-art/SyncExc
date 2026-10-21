import test from 'node:test';
import assert from 'node:assert/strict';

import { createCommentService } from '../../src/modules/community/comment.service.js';

function createService(overrides = {}) {
  const calls = {
    commentCountChanges: [],
    events: [],
    softDeletes: [],
  };
  const tx = { query: async () => ({ rows: [], rowCount: 1 }) };
  const defaults = {
    db: { tx: (callback) => callback(tx) },
    queries: {
      findPostById: async () => ({
        id: 'post-1',
        author_id: 'author-1',
        allow_comments: true,
        engagement: { reactions: 0, comments: 2, shares: 0 },
      }),
      insertComment: async (_client, comment) => ({ id: 'comment-1', ...comment }),
      insertCommentVersion: async () => {},
      adjustPostCommentCount: async (...args) => calls.commentCountChanges.push(args),
      findCommentById: async () => ({
        id: 'comment-1',
        post_id: 'post-1',
        author_id: 'author-1',
        current_version: 1,
      }),
      softDeleteComment: async (...args) => {
        calls.softDeletes.push(args);
        return true;
      },
      listCommentsForPost: async () => [],
    },
    events: {
      publish: async (...args) => calls.events.push(args),
    },
    realtime: null,
    logger: {},
  };
  const dependencies = {
    ...defaults,
    ...overrides,
    queries: { ...defaults.queries, ...overrides.queries },
    events: { ...defaults.events, ...overrides.events },
  };
  return { service: createCommentService(dependencies), calls, tx };
}

test('comment listing returns nested comments with the UI author shape', async () => {
  const { service } = createService({
    queries: {
      listCommentsForPost: async () => [
        {
          id: 'root',
          post_id: 'post-1',
          parent_id: null,
          author_id: 'user-1',
          author_handle: 'trader',
          author_name: 'Trader One',
          author_avatar: 'https://example.test/avatar.png',
          content: 'Root comment',
          created_at: new Date('2026-01-01T00:00:00Z'),
          updated_at: new Date('2026-01-01T00:00:00Z'),
        },
        {
          id: 'reply',
          post_id: 'post-1',
          parent_id: 'root',
          author_id: 'user-2',
          author_handle: 'analyst',
          author_name: 'Analyst Two',
          author_avatar: null,
          content: 'Reply',
          created_at: new Date('2026-01-02T00:00:00Z'),
          updated_at: new Date('2026-01-02T00:00:00Z'),
        },
      ],
    },
  });

  const comments = await service.listComments({ postId: 'post-1', limit: 20 });

  assert.equal(comments.length, 1);
  assert.equal(comments[0].author.displayName, 'Trader One');
  assert.equal(comments[0].replies[0].parentId, 'root');
  assert.equal(comments[0].replies[0].author.id, 'user-2');
});

test('creating a comment atomically increments the post comment count', async () => {
  const { service, calls, tx } = createService();

  await service.createComment({
    userId: 'author-1',
    postId: 'post-1',
    content: 'A comment',
  });

  assert.deepEqual(calls.commentCountChanges, [['post-1', 1, tx]]);
  assert.equal(calls.events.length, 1);
});

test('deleting a comment decrements the count only when the row was deleted', async () => {
  const { service, calls, tx } = createService();

  await service.deleteComment({ userId: 'author-1', commentId: 'comment-1' });
  assert.deepEqual(calls.commentCountChanges, [['post-1', -1, tx]]);

  calls.commentCountChanges.length = 0;
  const { service: alreadyDeleted, calls: alreadyDeletedCalls } = createService({
    queries: { softDeleteComment: async () => false },
  });
  await alreadyDeleted.deleteComment({ userId: 'author-1', commentId: 'comment-1' });
  assert.deepEqual(alreadyDeletedCalls.commentCountChanges, []);
});
