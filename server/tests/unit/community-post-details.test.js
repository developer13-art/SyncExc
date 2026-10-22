import test from 'node:test';
import assert from 'node:assert/strict';

import { createPostService } from '../../src/modules/community/ost.service.js';

test('public post details remain available when the author has no community profile row', async () => {
  const service = createPostService({
    db: {},
    queries: {
      findPostById: async () => ({
        id: 'post-1',
        author_id: 'author-1',
        author_visibility: 'public',
        destination_type: 'public_feed',
        visibility: 'public',
      }),
      findProfileByUserId: async () => null,
      isBlocked: async () => false,
      isFollowing: async () => false,
      listPostAttachments: async () => [],
      countReactions: async () => 0,
      hasReaction: async () => false,
      findPostBookmark: async () => null,
      getPollForPost: async () => null,
      getEventForPost: async () => null,
      getMarketIdeaForPost: async () => null,
    },
    events: {},
    realtime: null,
    attachmentService: { list: async () => [] },
    logger: {},
  });

  const result = await service.getPost({ postId: 'post-1', viewerId: 'viewer-1' });

  assert.equal(result.post.id, 'post-1');
});
