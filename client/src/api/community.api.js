import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const communityApi = {
  getMyProfile: () => api.get(endpoints.community.profilesMe),

  updateMyProfile: ({ bio, ...payload }) =>
    api.patch(endpoints.community.profilesMe, {
      ...payload,
      ...(bio !== undefined ? { biography: bio } : {}),
    }),

  updateMyPrivacy: (payload) =>
    api.patch(endpoints.community.profilePrivacy, payload),

  getProfile: (userId) => api.get(endpoints.community.profile(userId)),

  getProfilePosts: (userId, params) =>
    api.getPaged(endpoints.community.profilePosts(userId), { params }),

  follow: (userId) => api.post(endpoints.community.follows(userId), {}),

  unfollow: (userId) => api.delete(endpoints.community.unfollow(userId)),

  block: (userId) => api.post(endpoints.community.blocks(userId), {}),

  unblock: (userId) => api.delete(endpoints.community.unblock(userId)),

  listFollowing: (userId, params) =>
    api.getPaged(endpoints.community.following(userId), { params }),

  listFollowRequests: () => api.get(endpoints.community.followRequests),

  resolveFollowRequest: (followerId, approved) =>
    api.patch(endpoints.community.followRequest(followerId), { approved }),

  getFeed: (params) => api.getPaged(endpoints.community.feed, { params }),

  uploadAttachment: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.upload(endpoints.community.attachments, formData);
  },

  downloadAttachment: (attachmentId) =>
    api.download(endpoints.community.attachment(attachmentId)),

  deletePendingAttachment: (attachmentId) =>
    api.delete(endpoints.community.attachment(attachmentId)),

  listPosts: (params = {}) => {
    const query = { ...params };
    const authorId = query.authorId;
    delete query.authorId;
    if (authorId) {
      return api.getPaged(endpoints.community.profilePosts(authorId), { params: query });
    }
    if (query.groupId) {
      const groupId = query.groupId;
      delete query.groupId;
      return api.getPaged(endpoints.community.groupPosts(groupId), { params: query });
    }
    return api.getPaged(endpoints.community.posts, {
      params: { ...query, following: false },
    });
  },

  createPost: ({ destination, ...payload }) =>
    api.post(endpoints.community.createPost, {
      ...payload,
      destination: typeof destination === 'string'
        ? { type: destination === 'workspace' ? 'workspace_discussion' : 'public_feed' }
        : destination,
    }),

  getPost: (postId) => api.get(endpoints.community.post(postId)),

  updatePost: (postId, payload) => api.patch(endpoints.community.post(postId), payload),

  deletePost: (postId) => api.delete(endpoints.community.post(postId)),

  listComments: (postId, params) =>
    api.getPaged(endpoints.community.postComments(postId), { params }),

  createComment: (postId, payload) =>
    api.post(endpoints.community.postComments(postId), payload),

  updateComment: (commentId, payload) =>
    api.patch(endpoints.community.comment(commentId), payload),

  deleteComment: (commentId) => api.delete(endpoints.community.comment(commentId)),

  voteInPoll: (postId, optionIds) =>
    api.post(endpoints.community.pollVotes(postId), { optionIds }),

  updateEventRsvp: (postId, status) =>
    api.post(endpoints.community.eventRsvp(postId), { status }),

  addReaction: (payload) =>
    api.post(endpoints.community.reactions, {
      targetType: payload.targetType ?? 'post',
      targetId: payload.targetId ?? payload.postId,
      reactionType: payload.reactionType ?? payload.type ?? 'like',
    }),

  removeReaction: ({ targetType, targetId }) =>
    api.delete(endpoints.community.reaction(targetType, targetId)),

  listSavedItems: (params) => api.getPaged(endpoints.community.savedItems, { params }),

  saveItem: ({ postId, ...payload }) =>
    api.post(endpoints.community.savedItems, {
      resourceType: 'post',
      resourceId: postId,
      ...payload,
    }),

  removeSavedItem: (itemId) => api.delete(endpoints.community.savedItem(itemId)),

  listGroups: (params) => api.getPaged(endpoints.community.groups, { params }),

  createGroup: (payload) => api.post(endpoints.community.groups, payload),

  getGroup: (groupId) => api.get(endpoints.community.group(groupId)),

  listGroupMembers: (groupId, params) =>
    api.getPaged(endpoints.community.groupMembers(groupId), { params }),

  updateGroup: (groupId, payload) => api.patch(endpoints.community.group(groupId), payload),

  uploadGroupImage: (groupId, imageType, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.upload(endpoints.community.groupImage(groupId, imageType), formData);
  },

  joinGroup: (groupId, payload) =>
    api.post(endpoints.community.joinGroup(groupId), payload),

  leaveGroup: (groupId) => api.post(endpoints.community.leaveGroup(groupId), {}),

  inviteToGroup: (groupId, payload) =>
    api.post(endpoints.community.groupInvitations(groupId), payload),

  respondToGroupInvitation: (groupId, accepted) =>
    api.post(endpoints.community.groupInvitationResponse(groupId), { accepted }),

  removeGroupMember: (groupId, userId) =>
    api.delete(endpoints.community.groupMember(groupId, userId)),

  listGroupRequests: (groupId) =>
    api.getPaged(endpoints.community.groupRequests(groupId)),

  resolveGroupRequest: (groupId, userId, approved) =>
    api.patch(endpoints.community.groupRequest(groupId, userId), { approved }),

  setGroupMemberRole: (groupId, userId, role) =>
    api.put(endpoints.community.groupMemberRole(groupId, userId), { role }),

  listDiscussionChannels: () => api.get(endpoints.community.discussionChannels),

  createDiscussionChannel: (payload) =>
    api.post(endpoints.community.discussionChannels, payload),

  listDiscussionThreads: (channelId, params) =>
    api.getPaged(endpoints.community.discussionChannelThreads(channelId), { params }),

  createDiscussionThread: (channelId, payload) =>
    api.post(endpoints.community.discussionChannelThreads(channelId), payload),

  listDiscussionMessages: (threadId, params) =>
    api.getPaged(endpoints.community.discussionThreadMessages(threadId), { params }),

  createDiscussionMessage: (threadId, payload) =>
    api.post(endpoints.community.discussionThreadMessages(threadId), payload),

  listMessageConversations: (params) =>
    api.getPaged(endpoints.community.messageConversations, { params }),

  listMessageRequests: () => api.get(endpoints.community.messageRequests),

  startMessageConversation: (payload) =>
    api.post(endpoints.community.messageRequests, payload),

  resolveMessageRequest: (conversationId, accepted) =>
    api.post(endpoints.community.messageRequest(conversationId), { accepted }),

  listDirectMessages: (conversationId, params) =>
    api.getPaged(endpoints.community.conversationMessages(conversationId), { params }),

  sendDirectMessage: (conversationId, payload) =>
    api.post(endpoints.community.conversationMessages(conversationId), payload),

  listAnalysis: (params) => api.getPaged(endpoints.community.analysis, { params }),

  createAnalysis: (payload) => api.post(endpoints.community.analysis, payload),

  getAnalysis: (documentId) => api.get(endpoints.community.analysisDoc(documentId)),

  updateAnalysis: (documentId, payload) =>
    api.patch(endpoints.community.analysisDoc(documentId), payload),

  shareAnalysis: (documentId, payload) =>
    api.post(endpoints.community.shareAnalysis(documentId), payload),

  listAnalysisVersions: (documentId) =>
    api.get(endpoints.community.analysisVersions(documentId)),

  getRecommendationsPeople: (params) =>
    api.get(endpoints.community.recommendations, { params: { ...params, type: 'people' } }),

  getRecommendationsGroups: (params) =>
    api.get(endpoints.community.recommendations, { params: { ...params, type: 'groups' } }),

  submitRecommendationFeedback: ({ recommendationId, feedback }) =>
    api.post(endpoints.community.recommendationFeedback(recommendationId), { feedback }),

  search: (params) => api.get(endpoints.community.search, { params }),

  listNotifications: (params) =>
    api.getPaged(endpoints.community.notifications, { params }),

  updateNotification: (notificationId, payload) =>
    api.patch(endpoints.community.notification(notificationId), payload),

  updateNotificationPreferences: (payload) =>
    api.patch(endpoints.community.notificationPreferences, payload),

  submitReport: (payload) => api.post(endpoints.community.reports, payload),

  listMyReports: (params) => api.getPaged(endpoints.community.myReports, { params }),

  listMyModerationCases: (params) =>
    api.getPaged(endpoints.community.myModerationCases, { params }),

  listModerationCases: (params) =>
    api.getPaged(endpoints.community.moderationCases, { params }),

  applyModerationAction: (caseId, payload) =>
    api.post(endpoints.community.moderationActions(caseId), payload),

  submitModerationAppeal: (caseId, payload) =>
    api.post(endpoints.community.moderationAppeals(caseId), payload),

  decideModerationAppeal: (appealId, payload) =>
    api.post(endpoints.community.moderationAppealDecision(appealId), payload),

  getAudit: (params) => api.getPaged(endpoints.community.audit, { params }),
};