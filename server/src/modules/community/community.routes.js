/**
 * SyncExc Server — Community routes
 */

import { Router } from 'express';
import Joi from 'joi';
import { UuidSchema, PaginationSchema } from '@syncexc/shared';
import { createCommunityController } from './community.controller.js';

const FeedQuerySchema = PaginationSchema.keys({
  following: Joi.boolean().truthy('true').falsy('false').optional(),
});

const GroupsQuerySchema = PaginationSchema.keys({
  filter: Joi.string().valid('all', 'mine', 'public', 'private').optional(),
  q: Joi.string().trim().max(200).optional().allow(''),
});

const UpdateProfileSchema = Joi.object({
  displayName: Joi.string().trim().min(1).max(100).optional(),
  handle: Joi.string().trim().lowercase().pattern(/^[a-z0-9_]{3,32}$/).optional(),
  biography: Joi.string().trim().max(500).optional().allow(''),
  longIntroduction: Joi.string().trim().max(5000).optional().allow(''),
  avatarUrl: Joi.string().uri().optional().allow(''),
  interests: Joi.array().items(Joi.string().max(64)).max(20).optional(),
  skills: Joi.array().items(Joi.string().max(64)).max(20).optional(),
  website: Joi.string().uri().optional().allow(''),
  visibility: Joi.string().valid('public', 'followers', 'group_members', 'workspace_members', 'private').optional(),
}).min(1);

const UpdatePrivacySchema = Joi.object({
  allowFollows: Joi.boolean().optional(),
  allowMentions: Joi.boolean().optional(),
  allowDirectMessages: Joi.boolean().optional(),
  allowRecommendations: Joi.boolean().optional(),
}).min(1);

const FollowRequestDecisionSchema = Joi.object({
  approved: Joi.boolean().required(),
});

const CreatePostSchema = Joi.object({
  destination: Joi.object({
    type: Joi.string().valid('public_feed', 'group', 'workspace_discussion').required(),
    refId: UuidSchema.when('type', {
      is: Joi.valid('group', 'workspace_discussion'),
      then: UuidSchema.required(),
      otherwise: UuidSchema.optional(),
    }),
  }).required(),
  content: Joi.string().trim().min(1).max(10000).required(),
  topics: Joi.array().items(Joi.string().max(64)).max(10).optional(),
  attachments: Joi.array().items(
    Joi.object({
      type: Joi.string().max(64).required(),
      storageKey: Joi.string().required(),
      mimeType: Joi.string().optional(),
      sizeBytes: Joi.number().integer().optional(),
    })
  ).max(10).optional(),
  visibility: Joi.string().valid('public', 'followers', 'group_members', 'workspace_members', 'private').default('public'),
  allowComments: Joi.boolean().default(true),
});

const UpdatePostSchema = Joi.object({
  content: Joi.string().trim().min(1).max(10000).optional(),
  topics: Joi.array().items(Joi.string().max(64)).max(10).optional(),
  allowComments: Joi.boolean().optional(),
}).min(1);

const CommentSchema = Joi.object({
  content: Joi.string().trim().min(1).max(5000).required(),
  parentId: UuidSchema.optional(),
});

const UpdateCommentSchema = Joi.object({
  content: Joi.string().trim().min(1).max(5000).required(),
});

const ReactionSchema = Joi.object({
  targetType: Joi.string().valid('post', 'comment').required(),
  targetId: UuidSchema.required(),
  reactionType: Joi.string().valid('like', 'love', 'insightful', 'bullish', 'bearish').default('like'),
});

const CreateGroupSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9_-]{3,64}$/).required(),
  description: Joi.string().trim().max(2000).required(),
  type: Joi.string().valid('public', 'private', 'approval_based', 'organization').required(),
  topics: Joi.array().items(Joi.string().max(64)).max(10).optional(),
});

const UpdateGroupSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(2000).optional().allow(''),
  type: Joi.string().valid('public', 'private', 'approval_based', 'organization').optional(),
}).min(1);

const GroupRequestDecisionSchema = Joi.object({
  approved: Joi.boolean().required(),
});

const GroupRoleSchema = Joi.object({
  role: Joi.string().valid('administrator', 'moderator', 'member', 'read_only').required(),
});

const GroupInvitationSchema = Joi.object({
  userId: UuidSchema.required(),
});

const GroupInvitationResponseSchema = Joi.object({
  accepted: Joi.boolean().required(),
});

const CreateChannelSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  kind: Joi.string().valid('general', 'research', 'operations', 'development', 'announcements', 'custom').default('general'),
});

const CreateThreadSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
});

const MessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(10000).required(),
});

const CreateAnalysisSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  summary: Joi.string().trim().max(1000).optional().allow(''),
  content: Joi.string().trim().min(1).max(100000).required(),
  tags: Joi.array().items(Joi.string().max(64)).max(20).optional(),
  visibility: Joi.string().valid('public', 'followers', 'group_members', 'workspace_members', 'private').default('private'),
  sources: Joi.array().items(
    Joi.object({
      type: Joi.string().max(64).required(),
      ref: Joi.string().max(500).optional(),
      provenance: Joi.string().max(64).default('user_provided'),
    })
  ).optional(),
});

const GrantAnalysisPermissionSchema = Joi.object({
  granteeUserId: UuidSchema.optional(),
  granteeWorkspaceId: UuidSchema.optional(),
  permission: Joi.string().valid('view', 'comment', 'edit', 'manage_sharing', 'publish_externally').required(),
}).or('granteeUserId', 'granteeWorkspaceId');

const BookmarkSchema = Joi.object({
  resourceType: Joi.string().valid('post', 'comment', 'analysis', 'group').required(),
  resourceId: UuidSchema.required(),
  collection: Joi.string().max(64).optional(),
  note: Joi.string().max(500).optional(),
});

const ReportSchema = Joi.object({
  resourceType: Joi.string().valid('post', 'comment', 'profile', 'group', 'analysis').required(),
  resourceId: UuidSchema.required(),
  reason: Joi.string().valid('spam', 'harassment', 'impersonation', 'fraudulent_claims', 'misleading_content', 'private_info_disclosure', 'malicious_links', 'copyright', 'other').required(),
  details: Joi.string().max(2000).optional().allow(''),
});

const RecommendationFeedbackSchema = Joi.object({
  feedback: Joi.string().valid('dismissed', 'helpful', 'not_helpful', 'reported').required(),
});

const ModerationDecisionSchema = Joi.object({
  action: Joi.string().valid('dismiss', 'remove_content', 'add_warning', 'refer_to_admin').required(),
  reason: Joi.string().min(10).max(1000).required(),
  notes: Joi.string().max(2000).optional().allow(''),
});

const AppealSchema = Joi.object({
  reason: Joi.string().trim().min(10).max(2000).required(),
});

const AppealDecisionSchema = Joi.object({
  status: Joi.string().valid('upheld', 'overturned', 'dismissed').required(),
  resolution: Joi.string().trim().min(10).max(2000).required(),
});

export function createCommunityRoutes(services) {
  const controller = createCommunityController(services);
  const { middleware } = services;
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Profiles
   * ------------------------------------------------------------------------ */
  router.get(
    '/profiles/me',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getMyProfile)
  );

  router.patch(
    '/profiles/me',
    middleware.requireAuth(),
    middleware.validateBody(UpdateProfileSchema),
    middleware.asyncHandler(controller.updateProfile)
  );

  router.patch(
    '/profiles/me/privacy',
    middleware.requireAuth(),
    middleware.validateBody(UpdatePrivacySchema),
    middleware.asyncHandler(controller.updatePrivacy)
  );

  router.get(
    '/profiles/:userId',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.getProfile)
  );

  /* ---------------------------------------------------------------------------
   * Social graph
   * ------------------------------------------------------------------------ */
  router.post(
    '/follows/:userId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.follow)
  );

  router.delete(
    '/follows/:userId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.unfollow)
  );

  router.get(
    '/follows/requests',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listFollowRequests)
  );

  router.patch(
    '/follows/requests/:followerId',
    middleware.requireAuth(),
    middleware.validateBody(FollowRequestDecisionSchema),
    middleware.asyncHandler(controller.resolveFollowRequest)
  );

  router.get(
    '/users/:userId/followers',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.listFollowers)
  );

  router.get(
    '/users/:userId/following',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.listFollowing)
  );

  router.post(
    '/blocks/:userId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.block)
  );

  router.delete(
    '/blocks/:userId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.unblock)
  );

  router.get(
    '/blocks',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listBlocks)
  );

  /* ---------------------------------------------------------------------------
   * Feed and posts
   * ------------------------------------------------------------------------ */
  router.get(
    '/feed',
    middleware.requireAuth(),
    middleware.validateQuery(FeedQuerySchema),
    middleware.asyncHandler(controller.listFeed)
  );

  router.post(
    '/posts',
    middleware.requireAuth(),
    middleware.validateBody(CreatePostSchema),
    middleware.asyncHandler(controller.createPost)
  );

  router.get(
    '/posts/:postId',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.getPost)
  );

  router.patch(
    '/posts/:postId',
    middleware.requireAuth(),
    middleware.validateBody(UpdatePostSchema),
    middleware.asyncHandler(controller.updatePost)
  );

  router.delete(
    '/posts/:postId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.deletePost)
  );

  router.get(
    '/users/:userId/posts',
    middleware.optionalAuth(),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listPostsByAuthor)
  );

  /* Comments */
  router.post(
    '/posts/:postId/comments',
    middleware.requireAuth(),
    middleware.validateBody(CommentSchema),
    middleware.asyncHandler(controller.createComment)
  );

  router.get(
    '/posts/:postId/comments',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.listComments)
  );

  router.delete(
    '/comments/:commentId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.deleteComment)
  );

  router.patch(
    '/comments/:commentId',
    middleware.requireAuth(),
    middleware.validateBody(UpdateCommentSchema),
    middleware.asyncHandler(controller.updateComment)
  );

  /* Reactions */
  router.post(
    '/reactions',
    middleware.requireAuth(),
    middleware.validateBody(ReactionSchema),
    middleware.asyncHandler(controller.addReaction)
  );

  router.delete(
    '/reactions/:targetType/:targetId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.removeReaction)
  );

  /* ---------------------------------------------------------------------------
   * Groups
   * ------------------------------------------------------------------------ */
  router.get(
    '/groups',
    middleware.optionalAuth(),
    middleware.validateQuery(GroupsQuerySchema),
    middleware.asyncHandler(controller.listGroups)
  );

  router.post(
    '/groups',
    middleware.requireAuth(),
    middleware.validateBody(CreateGroupSchema),
    middleware.asyncHandler(controller.createGroup)
  );

  router.patch(
    '/groups/:groupId',
    middleware.requireAuth(),
    middleware.validateBody(UpdateGroupSchema),
    middleware.asyncHandler(controller.updateGroup)
  );

  router.get(
    '/groups/:groupId',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.getGroup)
  );

  router.post(
    '/groups/:groupId/join',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.joinGroup)
  );

  router.post(
    '/groups/:groupId/leave',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.leaveGroup)
  );

  router.get(
    '/groups/:groupId/members',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.listGroupMembers)
  );

  router.delete(
    '/groups/:groupId/members/:userId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.removeGroupMember)
  );

  router.put(
    '/groups/:groupId/members/:userId/role',
    middleware.requireAuth(),
    middleware.validateBody(GroupRoleSchema),
    middleware.asyncHandler(controller.setGroupMemberRole)
  );

  router.get(
    '/groups/:groupId/requests',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listGroupRequests)
  );

  router.patch(
    '/groups/:groupId/requests/:userId',
    middleware.requireAuth(),
    middleware.validateBody(GroupRequestDecisionSchema),
    middleware.asyncHandler(controller.resolveGroupRequest)
  );

  router.post(
    '/groups/:groupId/invitations',
    middleware.requireAuth(),
    middleware.validateBody(GroupInvitationSchema),
    middleware.asyncHandler(controller.inviteGroupMember)
  );

  router.post(
    '/groups/:groupId/invitations/respond',
    middleware.requireAuth(),
    middleware.validateBody(GroupInvitationResponseSchema),
    middleware.asyncHandler(controller.respondToGroupInvitation)
  );

  router.get(
    '/groups/:groupId/posts',
    middleware.optionalAuth(),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listGroupPosts)
  );

  /* ---------------------------------------------------------------------------
   * Discussions
   * ------------------------------------------------------------------------ */
  router.get(
    '/discussions/channels',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listChannels)
  );

  router.post(
    '/discussions/channels',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CreateChannelSchema),
    middleware.asyncHandler(controller.createChannel)
  );

  router.post(
    '/discussions/channels/:channelId/threads',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CreateThreadSchema),
    middleware.asyncHandler(controller.createThread)
  );

  router.get(
    '/discussions/channels/:channelId/threads',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listThreads)
  );

  router.post(
    '/discussions/threads/:threadId/messages',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(MessageSchema),
    middleware.asyncHandler(controller.postMessage)
  );

  router.get(
    '/discussions/threads/:threadId/messages',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listMessages)
  );

  /* ---------------------------------------------------------------------------
   * Analysis documents
   * ------------------------------------------------------------------------ */
  router.get(
    '/analysis',
    middleware.requireAuth(),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listAnalysis)
  );

  router.post(
    '/analysis',
    middleware.requireAuth(),
    middleware.validateBody(CreateAnalysisSchema),
    middleware.asyncHandler(controller.createAnalysis)
  );

  router.get(
    '/analysis/:documentId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getAnalysis)
  );

  router.get(
    '/analysis/:documentId/versions',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listAnalysisVersions)
  );

  router.patch(
    '/analysis/:documentId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.updateAnalysis)
  );

  router.post(
    '/analysis/:documentId/permissions',
    middleware.requireAuth(),
    middleware.validateBody(GrantAnalysisPermissionSchema),
    middleware.asyncHandler(controller.grantAnalysisPermission)
  );

  /* ---------------------------------------------------------------------------
   * Bookmarks
   * ------------------------------------------------------------------------ */
  router.get(
    '/bookmarks',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listBookmarks)
  );

  router.post(
    '/bookmarks',
    middleware.requireAuth(),
    middleware.validateBody(BookmarkSchema),
    middleware.asyncHandler(controller.addBookmark)
  );

  router.delete(
    '/bookmarks/:bookmarkId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.removeBookmark)
  );

  /* ---------------------------------------------------------------------------
   * Recommendations
   * ------------------------------------------------------------------------ */
  router.get(
    '/recommendations',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listRecommendations)
  );

  router.post(
    '/recommendations/refresh',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.refreshRecommendations)
  );

  router.post(
    '/recommendations/:recommendationId/feedback',
    middleware.requireAuth(),
    middleware.validateBody(RecommendationFeedbackSchema),
    middleware.asyncHandler(controller.submitRecommendationFeedback)
  );

  /* ---------------------------------------------------------------------------
   * Search
   * ------------------------------------------------------------------------ */
  router.get(
    '/search',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.search)
  );

  /* ---------------------------------------------------------------------------
   * Moderation
   * ------------------------------------------------------------------------ */
  router.post(
    '/reports',
    middleware.requireAuth(),
    middleware.validateBody(ReportSchema),
    middleware.asyncHandler(controller.submitReport)
  );

  router.post(
    '/moderation/cases/:caseId/appeal',
    middleware.requireAuth(),
    middleware.validateBody(AppealSchema),
    middleware.asyncHandler(controller.submitAppeal)
  );

  router.post(
    '/moderation/appeals/:appealId/decide',
    middleware.requireAuth(),
    middleware.requireAdmin(),
    middleware.validateBody(AppealDecisionSchema),
    middleware.asyncHandler(controller.decideAppeal)
  );

  router.get(
    '/moderation/audit',
    middleware.requireAuth(),
    middleware.requireAdmin(),
    middleware.validateQuery(PaginationSchema.keys({
      resourceType: Joi.string().max(64).optional(),
      resourceId: UuidSchema.optional(),
    })),
    middleware.asyncHandler(controller.listAudit)
  );

  router.get(
    '/moderation/cases',
    middleware.requireAuth(),
    middleware.requireAdmin(),
    middleware.asyncHandler(controller.listModerationCases)
  );

  router.post(
    '/moderation/cases/:caseId/decide',
    middleware.requireAuth(),
    middleware.requireAdmin(),
    middleware.validateBody(ModerationDecisionSchema),
    middleware.asyncHandler(controller.decideModerationCase)
  );

  return router;
}

export default createCommunityRoutes;