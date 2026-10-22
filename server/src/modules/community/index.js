/**
 * SyncExc Server — Community module (Module 15)
 *
 * Owns:
 *   - public profiles and privacy settings
 *   - social graph (follows, blocks)
 *   - posts, comments, reactions
 *   - groups and memberships
 *   - public community discussions
 *   - structured analysis documents
 *   - AI-assisted recommendations
 *   - moderation and reporting
 *   - permission-aware search
 *
 * Public API:
 *   community.profile.getProfile(userId)
 *   community.post.createPost(params)
 *   community.search.query(params)
 */

import { createCommunityQueries } from './community.queries.js';
import { createCommunityAttachmentService } from './attachment.service.js';
import { createProfileService } from './profile.service.js';
import { createSocialGraphService } from './social-graph.service.js';
import { createPostService } from './ost.service.js';
import { createCommentService } from './comment.service.js';
import { createMessagingQueries } from './messaging.queries.js';
import { createMessagingService } from './messaging.service.js';
import { createCommunityContentService } from './content.service.js';
import { createReactionService } from './reaction.service.js';
import { createGroupService } from './group.service.js';
import { createDiscussionService } from './discussion.service.js';
import { createAnalysisService } from './analysis.service.js';
import { createBookmarkService } from './bookmark.service.js';
import { createRecommendationService } from './recommendation.service.js';
import { createSearchService } from './search.service.js';
import { createModerationService } from './moderation.js';
import { createCommunityRoutes } from './community.routes.js';
import { createCommunityListeners } from './listeners.js';
import { createLogger } from '../../lib/logger.js';

export function createCommunityModule({ services }) {
  const logger = createLogger({ component: 'community' });

  const queries = createCommunityQueries({ db: services.db });
  const messagingQueries = createMessagingQueries({ db: services.db });
  const attachmentService = createCommunityAttachmentService({
    db: services.db,
    queries,
    storage: services.storage,
  });

  const profileService = createProfileService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const socialGraphService = createSocialGraphService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const postService = createPostService({
    db: services.db,
    queries,
    events: services.events,
    realtime: services.realtime,
    attachmentService,
    logger,
  });

  const commentService = createCommentService({
    db: services.db,
    queries,
    events: services.events,
    realtime: services.realtime,
    attachmentService,
    logger,
  });

  const messagingService = createMessagingService({
    db: services.db,
    queries,
    messagingQueries,
    events: services.events,
    attachmentService,
  });

  const contentService = createCommunityContentService({
    db: services.db,
    queries,
    postService,
  });

  const reactionService = createReactionService({
    db: services.db,
    queries,
    postService,
    logger,
  });

  const groupService = createGroupService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const discussionService = createDiscussionService({
    db: services.db,
    queries,
    events: services.events,
    realtime: services.realtime,
    attachmentService,
    logger,
  });

  const analysisService = createAnalysisService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const bookmarkService = createBookmarkService({
    db: services.db,
    queries,
    postService,
    analysisService,
    groupService,
    logger,
  });

  const searchService = createSearchService({
    db: services.db,
    queries,
    logger,
  });

  const recommendationService = createRecommendationService({
    db: services.db,
    queries,
    ai: services.ai,
    searchService,
    logger,
  });

  const moderationService = createModerationService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const routes = createCommunityRoutes({
    profileService,
    socialGraphService,
    postService,
    commentService,
    reactionService,
    groupService,
    discussionService,
    analysisService,
    bookmarkService,
    recommendationService,
    searchService,
    moderationService,
    messagingService,
    contentService,
    attachmentService,
    middleware: services.middleware,
  });

  const listeners = createCommunityListeners({
    events: services.events,
    searchService,
    logger,
  });

  const publicApi = {
    profile: {
      getProfile: (userId) => profileService.getProfileByUserId(userId),
    },
    post: {
      createPost: (params) => postService.createPost(params),
    },
    search: {
      query: (params) => searchService.search(params),
    },
  };

  return {
    name: 'community',
    routes,
    queries,
    profile: profileService,
    socialGraph: socialGraphService,
    post: postService,
    comment: commentService,
    attachment: attachmentService,
    reaction: reactionService,
    group: groupService,
    discussion: discussionService,
    analysis: analysisService,
    bookmark: bookmarkService,
    recommendation: recommendationService,
    search: searchService,
    moderation: moderationService,
    publicApi,

    async shutdown() {
      logger.debug('Community module shutdown');
    },
  };
}

export default createCommunityModule;