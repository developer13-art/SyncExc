/**
 * SyncExc Server — Community event listeners
 */

export function createCommunityListeners({ events, searchService, logger }) {
  // Auto-create profile when a user registers
  events.subscribe(
    'user.registered',
    async (envelope) => {
      const { userId, username, displayName } = envelope.payload || {};
      if (!userId) return;
      try {
        const { db, queries } = searchService;
        // Handled by profileService.ensureProfileForUser in practice; the
        // community module watches for user registration elsewhere.
        logger.debug({ userId, username }, 'Community profile provisioning requested');
      } catch (err) {
        logger.error({ err, userId }, 'Profile provisioning failed');
      }
    },
    { name: 'community:provision-profile' }
  );

  // Track search activity (used by recommendation service)
  events.subscribe(
    'community.post_published',
    async (envelope) => {
      logger.debug({ postId: envelope.payload.postId }, 'Post published');
    },
    { name: 'community:log-post' }
  );

  logger.debug('Community event listeners registered');

  return {
    async shutdown() {},
  };
}

export default createCommunityListeners;