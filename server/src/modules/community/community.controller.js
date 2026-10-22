/**
 * SyncExc Server — Community controller
 */

import { success, created, paginated } from '../../lib/response.js';
import { serializeCommunityProfile, serializePost, serializeCommunityGroup } from '../../lib/serializers.js';
import { ValidationError } from '../../lib/errors.js';

export function createCommunityController(services) {
  const {
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
  } = services;

  return {
    /* Profile */
    async getMyProfile(req, res) {
      await profileService.ensureProfileForUser(req.auth.userId);
      const result = await profileService.getProfileWithPrivacy({
        userId: req.auth.userId,
        viewerId: req.auth.userId,
      });
      return success(res, serializeProfileResult(result));
    },

    async getProfile(req, res) {
      const handleOrId = req.params.userId;
      let profile;
      // Try handle first, then UUID
      profile = await profileService.getProfileByHandle(handleOrId);
      if (!profile && /^[0-9a-f-]{36}$/i.test(handleOrId)) {
        profile = await profileService.getProfileByUserId(handleOrId);
        if (!profile) {
          profile = await profileService.ensureProfileForUser(handleOrId);
        }
      }
      if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profile not found' } });

      const result = await profileService.getProfileWithPrivacy({
        userId: profile.user_id,
        viewerId: req.auth?.userId || null,
      });
      return success(res, serializeProfileResult(result));
    },

    async updateProfile(req, res) {
      const profile = await profileService.updateProfile({
        userId: req.auth.userId,
        updates: req.body,
      });
      return success(res, serializeCommunityProfile(profile));
    },

    async updatePrivacy(req, res) {
      const privacy = await profileService.updatePrivacy({
        userId: req.auth.userId,
        updates: req.body,
      });
      return success(res, privacy);
    },

    /* Social graph */
    async follow(req, res) {
      const result = await socialGraphService.follow({
        followerId: req.auth.userId,
        followeeId: req.params.userId,
      });
      return created(res, result);
    },

    async unfollow(req, res) {
      const result = await socialGraphService.unfollow({
        followerId: req.auth.userId,
        followeeId: req.params.userId,
      });
      return success(res, result);
    },

    async listFollowers(req, res) {
      const followers = await socialGraphService.listFollowers(req.params.userId, {
        limit: Number(req.query.limit) || 50,
      });
      return success(res, followers);
    },

    async listFollowing(req, res) {
      const following = await socialGraphService.listFollowing(req.params.userId, {
        limit: Number(req.query.limit) || 50,
      });
      return success(res, following);
    },

    async listFollowRequests(req, res) {
      const requests = await socialGraphService.listFollowRequests(req.auth.userId);
      return success(res, requests);
    },

    async resolveFollowRequest(req, res) {
      const result = await socialGraphService.resolveFollowRequest({
        followeeId: req.auth.userId,
        followerId: req.params.followerId,
        approved: req.body.approved,
      });
      return success(res, result);
    },

    async block(req, res) {
      const result = await socialGraphService.block({
        blockerId: req.auth.userId,
        blockedId: req.params.userId,
      });
      return created(res, result);
    },

    async unblock(req, res) {
      const result = await socialGraphService.unblock({
        blockerId: req.auth.userId,
        blockedId: req.params.userId,
      });
      return success(res, result);
    },

    async listBlocks(req, res) {
      const blocks = await socialGraphService.listBlocks(req.auth.userId);
      return success(res, blocks);
    },

    /* Posts */
    async listFeed(req, res) {
      const { rows, nextCursor } = await postService.listFeed({
        userId: req.auth.userId,
        followingOnly: req.query.following === true || req.query.following === 'true',
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializePost), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async createPost(req, res) {
      const post = await postService.createPost({
        userId: req.auth.userId,
        workspaceId: req.workspace?.id || null,
        destinationType: req.body.destination?.type || 'public_feed',
        destinationRefId: req.body.destination?.refId || null,
        content: req.body.content,
        topics: req.body.topics || [],
        attachmentIds: req.body.attachmentIds || [],
        visibility: req.body.visibility || 'public',
        allowComments: req.body.allowComments ?? true,
        poll: req.body.poll,
        event: req.body.event,
        marketIdea: req.body.marketIdea,
      });
      return created(res, serializePost(post));
    },

    async getPost(req, res) {
      const result = await postService.getPost({
        postId: req.params.postId,
        viewerId: req.auth?.userId || null,
        workspaceId: req.workspace?.id || null,
      });
      return success(res, {
        ...serializePost(result.post),
        attachments: result.attachments,
        reactionsCount: result.reactionsCount,
      });
    },

    async updatePost(req, res) {
      const post = await postService.updatePost({
        userId: req.auth.userId,
        postId: req.params.postId,
        content: req.body.content,
        topics: req.body.topics,
        allowComments: req.body.allowComments,
      });
      return success(res, serializePost(post));
    },

    async deletePost(req, res) {
      const result = await postService.deletePost({
        userId: req.auth.userId,
        postId: req.params.postId,
      });
      return success(res, result);
    },

    async listPostsByAuthor(req, res) {
      const { rows, nextCursor } = await postService.listPostsByAuthor({
        authorId: req.params.userId,
        viewerId: req.auth?.userId || null,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializePost), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    /* Comments */
    async createComment(req, res) {
      await postService.getPost({
        postId: req.params.postId,
        viewerId: req.auth.userId,
        workspaceId: req.workspace?.id || null,
      });
      const comment = await commentService.createComment({
        userId: req.auth.userId,
        postId: req.params.postId,
        parentId: req.body.parentId || null,
        content: req.body.content,
        attachmentIds: req.body.attachmentIds || [],
      });
      return created(res, comment);
    },

    async listComments(req, res) {
      await postService.getPost({
        postId: req.params.postId,
        viewerId: req.auth?.userId || null,
        workspaceId: req.workspace?.id || null,
      });
      const comments = await commentService.listComments({
        postId: req.params.postId,
        limit: Number(req.query.limit) || 200,
      });
      return success(res, comments);
    },

    async updateComment(req, res) {
      const comment = await commentService.updateComment({
        userId: req.auth.userId,
        commentId: req.params.commentId,
        content: req.body.content,
      });
      return success(res, comment);
    },

    async deleteComment(req, res) {
      const result = await commentService.deleteComment({
        userId: req.auth.userId,
        commentId: req.params.commentId,
      });
      return success(res, result);
    },

    /* Reactions */
    async addReaction(req, res) {
      const reaction = await reactionService.addReaction({
        userId: req.auth.userId,
        targetType: req.body.targetType,
        targetId: req.body.targetId,
        reactionType: req.body.reactionType || 'like',
      });
      return created(res, reaction);
    },

    async removeReaction(req, res) {
      const result = await reactionService.removeReaction({
        userId: req.auth.userId,
        targetType: req.params.targetType,
        targetId: req.params.targetId,
      });
      return success(res, result);
    },

    /* Groups */
    async listGroups(req, res) {
      const { rows, nextCursor } = await groupService.listPublicGroups({
        userId: req.auth?.userId || null,
        filter: req.query.filter || 'all',
        query: req.query.q || null,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeCommunityGroup), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async createGroup(req, res) {
      const group = await groupService.createGroup({
        userId: req.auth.userId,
        workspaceId: req.workspace?.id || null,
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description,
        type: req.body.type,
        topics: req.body.topics,
      });
      return created(res, serializeCommunityGroup(group));
    },

    async updateGroup(req, res) {
      const group = await groupService.updateGroup({
        groupId: req.params.groupId,
        userId: req.auth.userId,
        updates: req.body,
      });
      return success(res, serializeCommunityGroup(group));
    },

    async getGroup(req, res) {
      const group = await groupService.getGroup({
        groupId: req.params.groupId,
        viewerId: req.auth?.userId || null,
      });
      return success(res, serializeCommunityGroup(group));
    },

    async joinGroup(req, res) {
      const result = await groupService.joinGroup({
        userId: req.auth.userId,
        groupId: req.params.groupId,
      });
      return created(res, result);
    },

    async leaveGroup(req, res) {
      const result = await groupService.leaveGroup({
        userId: req.auth.userId,
        groupId: req.params.groupId,
      });
      return success(res, result);
    },

    async listGroupMembers(req, res) {
      const members = await groupService.listMembers({
        groupId: req.params.groupId,
        viewerId: req.auth?.userId || null,
        limit: Number(req.query.limit) || 100,
      });
      return success(res, members);
    },

    async listGroupPosts(req, res) {
      const { rows, nextCursor } = await groupService.listGroupPosts({
        groupId: req.params.groupId,
        viewerId: req.auth?.userId || null,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializePost), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async removeGroupMember(req, res) {
      const result = await groupService.removeMember({
        groupId: req.params.groupId,
        userId: req.auth.userId,
        targetUserId: req.params.userId,
      });
      return success(res, result);
    },

    async setGroupMemberRole(req, res) {
      const role = await groupService.setMemberRole({
        groupId: req.params.groupId,
        userId: req.auth.userId,
        targetUserId: req.params.userId,
        role: req.body.role,
      });
      return success(res, role);
    },

    async listGroupRequests(req, res) {
      const requests = await groupService.listJoinRequests({
        groupId: req.params.groupId,
        userId: req.auth.userId,
        limit: Number(req.query.limit) || 100,
      });
      return success(res, requests);
    },

    async resolveGroupRequest(req, res) {
      const membership = await groupService.resolveJoinRequest({
        groupId: req.params.groupId,
        userId: req.auth.userId,
        targetUserId: req.params.userId,
        approved: req.body.approved,
      });
      return success(res, membership);
    },

    async inviteGroupMember(req, res) {
      const invitation = await groupService.inviteMember({
        groupId: req.params.groupId,
        userId: req.auth.userId,
        targetUserId: req.body.userId,
      });
      return created(res, invitation);
    },

    async respondToGroupInvitation(req, res) {
      const invitation = await groupService.respondToInvitation({
        groupId: req.params.groupId,
        userId: req.auth.userId,
        accepted: req.body.accepted,
      });
      return success(res, invitation);
    },

    /* Discussions */
    async listChannels(_req, res) {
      const channels = await discussionService.listChannels();
      return success(res, channels);
    },

    async createChannel(req, res) {
      const channel = await discussionService.createChannel({
        name: req.body.name,
        kind: req.body.kind,
      });
      return created(res, channel);
    },

    async createThread(req, res) {
      const thread = await discussionService.createThread({
        userId: req.auth.userId,
        channelId: req.params.channelId,
        title: req.body.title,
      });
      return created(res, thread);
    },

    async listThreads(req, res) {
      const threads = await discussionService.listThreads({
        channelId: req.params.channelId,
        limit: Number(req.query.limit) || 50,
      });
      return success(res, threads);
    },

    async postMessage(req, res) {
      const message = await discussionService.postMessage({
        userId: req.auth.userId,
        threadId: req.params.threadId,
        content: req.body.content,
        attachmentIds: req.body.attachmentIds || [],
      });
      return created(res, message);
    },

    async startMessageConversation(req, res) {
      const result = await messagingService.startConversation({
        userId: req.auth.userId,
        recipientId: req.body.recipientId,
        content: req.body.content,
        attachmentIds: req.body.attachmentIds || [],
      });
      return created(res, result);
    },

    async listMessageConversations(req, res) {
      const { rows, nextCursor } = await messagingService.listConversations({
        userId: req.auth.userId,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows, {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async listMessageRequests(req, res) {
      const requests = await messagingService.listRequests({
        userId: req.auth.userId,
        limit: Number(req.query.limit) || 50,
      });
      return success(res, requests);
    },

    async resolveMessageRequest(req, res) {
      const conversation = await messagingService.resolveRequest({
        userId: req.auth.userId,
        conversationId: req.params.conversationId,
        accepted: req.body.accepted,
      });
      return success(res, conversation);
    },

    async listDirectMessages(req, res) {
      const { rows, nextCursor } = await messagingService.listMessages({
        userId: req.auth.userId,
        conversationId: req.params.conversationId,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows, {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async sendDirectMessage(req, res) {
      const result = await messagingService.sendMessage({
        userId: req.auth.userId,
        conversationId: req.params.conversationId,
        content: req.body.content,
        attachmentIds: req.body.attachmentIds || [],
      });
      return created(res, result);
    },

    async voteInPoll(req, res) {
      const poll = await contentService.votePoll({
        userId: req.auth.userId,
        postId: req.params.postId,
        optionIds: req.body.optionIds,
        workspaceId: req.workspace?.id || null,
      });
      return success(res, poll);
    },

    async updateEventRsvp(req, res) {
      const event = await contentService.updateEventRsvp({
        userId: req.auth.userId,
        postId: req.params.postId,
        status: req.body.status,
        workspaceId: req.workspace?.id || null,
      });
      return success(res, event);
    },

    async listMessages(req, res) {
      const messages = await discussionService.listMessages({
        threadId: req.params.threadId,
        limit: Number(req.query.limit) || 200,
      });
      return success(res, messages);
    },

    async uploadAttachment(req, res) {
      if (!req.file) throw new ValidationError('Choose a file to upload');
      const attachment = await attachmentService.upload({
        userId: req.auth.userId,
        file: req.file,
      });
      return created(res, attachment);
    },

    async downloadAttachment(req, res) {
      const download = await attachmentService.download({
        userId: req.auth.userId,
        attachmentId: req.params.attachmentId,
        postService,
        commentService,
        messagingService,
        discussionService,
      });
      res.setHeader('Content-Type', download.mimeType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(download.fileName)}`
      );
      return res.send(download.buffer);
    },

    async deletePendingAttachment(req, res) {
      const result = await attachmentService.deletePending({
        userId: req.auth.userId,
        attachmentId: req.params.attachmentId,
      });
      return success(res, result);
    },

    /* Analysis documents */
    async createAnalysis(req, res) {
      const document = await analysisService.createDocument({
        userId: req.auth.userId,
        workspaceId: req.workspace?.id || null,
        title: req.body.title,
        summary: req.body.summary,
        content: req.body.content,
        tags: req.body.tags || [],
        visibility: req.body.visibility || 'private',
        sources: req.body.sources || [],
      });
      return created(res, document);
    },

    async listAnalysis(req, res) {
      const { rows, nextCursor } = await analysisService.listDocuments({
        userId: req.auth.userId,
        workspaceId: req.workspace?.id || null,
        query: req.query.q,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeAnalysisDocument), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async getAnalysis(req, res) {
      const document = await analysisService.getDocument({
        documentId: req.params.documentId,
        viewerId: req.auth.userId,
        workspaceId: req.workspace?.id || null,
      });
      return success(res, document);
    },

    async updateAnalysis(req, res) {
      const document = await analysisService.updateDocument({
        userId: req.auth.userId,
        documentId: req.params.documentId,
        content: req.body.content,
        title: req.body.title,
        summary: req.body.summary,
        tags: req.body.tags,
        workspaceId: req.workspace?.id || null,
      });
      return success(res, document);
    },

    async listAnalysisVersions(req, res) {
      const versions = await analysisService.listVersions({
        documentId: req.params.documentId,
        viewerId: req.auth.userId,
        workspaceId: req.workspace?.id || null,
      });
      return success(res, versions);
    },

    async grantAnalysisPermission(req, res) {
      const permission = await analysisService.grantPermission({
        userId: req.auth.userId,
        documentId: req.params.documentId,
        granteeUserId: req.body.granteeUserId,
        granteeWorkspaceId: req.body.granteeWorkspaceId,
        permission: req.body.permission,
      });
      return created(res, permission);
    },

    /* Bookmarks */
    async listBookmarks(req, res) {
      const bookmarks = await bookmarkService.listBookmarks({
        userId: req.auth.userId,
        workspaceId: req.workspace?.id || null,
        limit: Number(req.query.limit) || 100,
      });
      return success(res, bookmarks);
    },

    async addBookmark(req, res) {
      const bookmark = await bookmarkService.addBookmark({
        userId: req.auth.userId,
        resourceType: req.body.resourceType,
        resourceId: req.body.resourceId,
        collection: req.body.collection,
        note: req.body.note,
        workspaceId: req.workspace?.id || null,
      });
      return created(res, bookmark);
    },

    async removeBookmark(req, res) {
      const result = await bookmarkService.removeBookmark({
        userId: req.auth.userId,
        bookmarkId: req.params.bookmarkId,
      });
      return success(res, result);
    },

    /* Recommendations */
    async listRecommendations(req, res) {
      const recommendations = await recommendationService.listRecommendations({
        userId: req.auth.userId,
        type: req.query.type,
        limit: Number(req.query.limit) || 20,
      });
      return success(res, recommendations);
    },

    async refreshRecommendations(req, res) {
      const result = await recommendationService.refreshRecommendations({
        userId: req.auth.userId,
      });
      return success(res, result);
    },

    async submitRecommendationFeedback(req, res) {
      const result = await recommendationService.submitFeedback({
        userId: req.auth.userId,
        recommendationId: req.params.recommendationId,
        feedback: req.body.feedback,
      });
      return created(res, result);
    },

    /* Search */
    async search(req, res) {
      const result = await searchService.search({
        userId: req.auth.userId,
        query: req.query.q,
        filters: req.query.types
          ? { types: req.query.types.split(',') }
          : req.query.type
            ? { types: [req.query.type] }
            : {},
        limit: Number(req.query.limit) || 50,
      });
      return success(res, result);
    },

    /* Moderation */
    async submitReport(req, res) {
      const result = await moderationService.submitReport({
        userId: req.auth.userId,
        resourceType: req.body.resourceType,
        resourceId: req.body.resourceId,
        reason: req.body.reason,
        details: req.body.details,
      });
      return created(res, result);
    },

    async listMyReports(req, res) {
      const { rows, nextCursor } = await moderationService.listMyReports(req.auth.userId, {
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows, { nextCursor, limit: Number(req.query.limit) || 50 });
    },

    async listMyModerationCases(req, res) {
      const { rows, nextCursor } = await moderationService.listMyCases(req.auth.userId, {
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows, { nextCursor, limit: Number(req.query.limit) || 50 });
    },

    async submitAppeal(req, res) {
      const result = await moderationService.submitAppeal({
        userId: req.auth.userId,
        caseId: req.params.caseId,
        reason: req.body.reason,
      });
      return created(res, result);
    },

    async listModerationCases(req, res) {
      const { rows, nextCursor } = await moderationService.listCases({
        state: req.query.state,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows, { nextCursor, limit: Number(req.query.limit) || 50 });
    },

    async decideModerationCase(req, res) {
      const result = await moderationService.decide({
        caseId: req.params.caseId,
        actorId: req.auth.userId,
        action: req.body.action,
        reason: req.body.reason,
        notes: req.body.notes,
      });
      return success(res, result);
    },

    async decideAppeal(req, res) {
      const result = await moderationService.decideAppeal({
        appealId: req.params.appealId,
        actorId: req.auth.userId,
        status: req.body.status,
        resolution: req.body.resolution,
      });
      return success(res, result);
    },

    async listAudit(req, res) {
      const { rows, nextCursor } = await moderationService.listAudit({
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
        resourceType: req.query.resourceType || null,
        resourceId: req.query.resourceId || null,
      });
      return paginated(res, rows, {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },
  };

  function serializeProfileResult(result) {
    return {
      ...serializeCommunityProfile(result.profile),
      followersCount: result.followersCount,
      followingCount: result.followingCount,
      viewerIsFollowing: result.isFollowing,
      viewerHasPendingFollowRequest: result.viewerHasPendingFollowRequest,
      viewerCanMessage: result.viewerCanMessage,
      ...(result.privacy
        ? {
            privacy: {
              allowFollows: result.privacy.allow_follows,
              allowMentions: result.privacy.allow_mentions,
              allowDirectMessages: result.privacy.allow_direct_messages,
              allowRecommendations: result.privacy.allow_recommendations,
            },
          }
        : {}),
    };
  }
}

function serializeAnalysisDocument(row) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary || null,
    content: row.content || null,
    tags: row.tags || [],
    visibility: row.visibility,
    version: row.version ?? row.current_version,
    authorId: row.author_id,
    author: row.author_name
      ? { id: row.author_id, handle: row.author_handle, displayName: row.author_name }
      : null,
    sources: row.sources || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default createCommunityController;