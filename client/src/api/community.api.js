import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const communityApi = {
  getMyProfile: () => api.get(endpoints.community.profilesMe),

  updateMyProfile: (payload) => api.patch(endpoints.community.profilesMe, payload),

  getProfile: (userId) => api.get(endpoints.community.profile(userId)),

  getProfilePosts: (userId, params) =>
    api.getPaged(endpoints.community.profilePosts(userId), { params }),

  follow: (userId, payload) => api.post(endpoints.community.follows, { userId, ...payload }),

  unfollow: (userId) => api.delete(endpoints.community.unfollow(userId)),

  block: (userId, payload) => api.post(endpoints.community.blocks, { userId, ...payload }),

  unblock: (userId) => api.delete(endpoints.community.unblock(userId)),

  listFollowing: (params) => api.getPaged(endpoints.community.following, { params }),

  getFeed: (params) => api.getPaged(endpoints.community.feed, { params }),

  listPosts: (params) => api.getPaged(endpoints.community.posts, { params }),

  createPost: (payload) => api.post(endpoints.community.posts, payload),

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

  addReaction: (payload) => api.post(endpoints.community.reactions, payload),

  removeReaction: (reactionId) => api.delete(endpoints.community.reaction(reactionId)),

  listSavedItems: (params) => api.getPaged(endpoints.community.savedItems, { params }),

  saveItem: (payload) => api.post(endpoints.community.savedItems, payload),

  removeSavedItem: (itemId) => api.delete(endpoints.community.savedItem(itemId)),

  listGroups: (params) => api.getPaged(endpoints.community.groups, { params }),

  createGroup: (payload) => api.post(endpoints.community.groups, payload),

  getGroup: (groupId) => api.get(endpoints.community.group(groupId)),

  updateGroup: (groupId, payload) => api.patch(endpoints.community.group(groupId), payload),

  joinGroup: (groupId, payload) =>
    api.post(endpoints.community.joinGroup(groupId), payload),

  leaveGroup: (groupId) => api.delete(endpoints.community.joinGroup(groupId)),

  inviteToGroup: (groupId, payload) =>
    api.post(endpoints.community.groupInvitations(groupId), payload),

  removeGroupMember: (groupId, userId) =>
    api.post(endpoints.community.removeGroupMember(groupId, userId)),

  listGroupThreads: (groupId, params) =>
    api.getPaged(endpoints.community.groupThreads(groupId), { params }),

  createDiscussion: (payload) => api.post(endpoints.community.discussions, payload),

  listDiscussionMessages: (threadId, params) =>
    api.getPaged(endpoints.community.discussionMessages(threadId), { params }),

  createDiscussionMessage: (threadId, payload) =>
    api.post(endpoints.community.discussionMessages(threadId), payload),

  listAnalysis: (params) => api.getPaged(endpoints.community.analysis, { params }),

  createAnalysis: (payload) => api.post(endpoints.community.analysis, payload),

  getAnalysis: (documentId) => api.get(endpoints.community.analysisDoc(documentId)),

  updateAnalysis: (documentId, payload) =>
    api.patch(endpoints.community.analysisDoc(documentId), payload),

  shareAnalysis: (documentId, payload) =>
    api.post(endpoints.community.shareAnalysis(documentId), payload),

  publishAnalysis: (documentId, payload) =>
    api.post(endpoints.community.publishAnalysis(documentId), payload),

  getRecommendationsPeople: (params) =>
    api.get(endpoints.community.recommendationsPeople, { params }),

  getRecommendationsGroups: (params) =>
    api.get(endpoints.community.recommendationsGroups, { params }),

  submitRecommendationFeedback: (payload) =>
    api.post(endpoints.community.recommendationFeedback, payload),

  search: (params) => api.get(endpoints.community.search, { params }),

  listNotifications: (params) =>
    api.getPaged(endpoints.community.notifications, { params }),

  updateNotification: (notificationId, payload) =>
    api.patch(endpoints.community.notification(notificationId), payload),

  updateNotificationPreferences: (payload) =>
    api.patch(endpoints.community.notificationPreferences, payload),

  submitReport: (payload) => api.post(endpoints.community.reports, payload),

  getModerationCase: (caseId) =>
    api.get(endpoints.community.moderationCases(caseId)),

  applyModerationAction: (caseId, payload) =>
    api.post(endpoints.community.moderationActions(caseId), payload),

  submitModerationAppeal: (caseId, payload) =>
    api.post(endpoints.community.moderationAppeals(caseId), payload),

  getAudit: (params) => api.getPaged(endpoints.community.audit, { params }),
};