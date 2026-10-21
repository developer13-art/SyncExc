/**
 * SyncExc Server — Community events
 */

export const COMMUNITY_EMITS = [
  'community.profile_updated',
  'community.follow_created',
  'community.follow_request_accepted',
  'community.post_published',
  'community.comment_posted',
  'community.group_created',
  'community.member_joined_group',
  'community.thread_created',
  'community.analysis_created',
  'community.report_submitted',
  'community.moderation_action',
];

export const COMMUNITY_CONSUMES = [
  'user.registered',
];

export default {
  COMMUNITY_EMITS,
  COMMUNITY_CONSUMES,
};