/**
 * SyncExc Server — Community queries
 */

export function createCommunityQueries({ db }) {
  return {
    /* =========================================================================
     * PROFILES
     * ====================================================================== */

    async insertProfile(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_profiles (
          user_id, handle, display_name, biography, long_introduction, visibility, avatar_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.userId,
          data.handle,
          data.displayName,
          data.biography || null,
          data.longIntroduction || null,
          data.visibility || 'public',
          data.avatarUrl || null,
        ]
      );
      return result.rows[0];
    },

    async deleteGroupRole(client, groupId, userId) {
      await client.query(
        `DELETE FROM community_group_roles WHERE group_id = $1 AND user_id = $2`,
        [groupId, userId]
      );
    },

    async insertGroupInvitation(client, { groupId, invitedUserId, invitedBy }) {
      const result = await client.query(
        `
        INSERT INTO community_group_invitations (group_id, invited_user_id, invited_by)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [groupId, invitedUserId, invitedBy]
      );
      return result.rows[0];
    },

    async findPendingGroupInvitation(groupId, invitedUserId) {
      const result = await db.query(
        `
        SELECT * FROM community_group_invitations
        WHERE group_id = $1 AND invited_user_id = $2 AND state = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [groupId, invitedUserId]
      );
      return result.rows[0] || null;
    },

    async updateGroupInvitation(client, invitationId, state) {
      const result = await client.query(
        `
        UPDATE community_group_invitations
        SET state = $2, resolved_at = now()
        WHERE id = $1 AND state = 'pending'
        RETURNING *
        `,
        [invitationId, state]
      );
      return result.rows[0] || null;
    },

    async findProfileByUserId(userId) {
      const result = await db.query(
        `SELECT * FROM community_profiles WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0] || null;
    },

    async findProfileByHandle(handle) {
      const result = await db.query(
        `SELECT * FROM community_profiles WHERE handle = $1`,
        [handle]
      );
      return result.rows[0] || null;
    },

    async updateProfile(profileId, fields, client = db) {
      const result = await client.query(
        `
        UPDATE community_profiles
        SET display_name = COALESCE($2, display_name),
            handle = COALESCE($3, handle),
            biography = COALESCE($4, biography),
            long_introduction = COALESCE($5, long_introduction),
            avatar_url = COALESCE($6, avatar_url),
            interests = COALESCE($7, interests),
            skills = COALESCE($8, skills),
            website = COALESCE($9, website),
            visibility = COALESCE($10, visibility),
            current_version = current_version + 1,
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          profileId,
          fields.displayName ?? null,
          fields.handle ?? null,
          fields.biography ?? null,
          fields.longIntroduction ?? null,
          fields.avatarUrl ?? null,
          fields.interests ?? null,
          fields.skills ?? null,
          fields.website ?? null,
          fields.visibility ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertProfileVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_profile_versions (profile_id, version, snapshot)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.profileId, data.version, JSON.stringify(data.snapshot)]
      );
      return result.rows[0];
    },

    async upsertProfilePrivacy(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_profile_privacy (
          profile_id, allow_follows, allow_mentions, allow_direct_messages, allow_recommendations
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (profile_id) DO UPDATE SET
          allow_follows = EXCLUDED.allow_follows,
          allow_mentions = EXCLUDED.allow_mentions,
          allow_direct_messages = EXCLUDED.allow_direct_messages,
          allow_recommendations = EXCLUDED.allow_recommendations,
          updated_at = now()
        RETURNING *
        `,
        [
          data.profileId,
          data.allowFollows ?? true,
          data.allowMentions ?? true,
          data.allowDirectMessages ?? false,
          data.allowRecommendations ?? true,
        ]
      );
      return result.rows[0];
    },

    async getProfilePrivacy(profileId) {
      const result = await db.query(
        `SELECT * FROM community_profile_privacy WHERE profile_id = $1`,
        [profileId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * SOCIAL GRAPH
     * ====================================================================== */

    async insertFollow(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_follows (follower_id, followee_id)
        VALUES ($1, $2)
        ON CONFLICT (follower_id, followee_id) DO NOTHING
        RETURNING *
        `,
        [data.followerId, data.followeeId]
      );
      return result.rows[0] || null;
    },

    async insertFollowRequest(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_follow_requests (follower_id, followee_id, state)
        VALUES ($1, $2, 'pending')
        ON CONFLICT (follower_id, followee_id) DO UPDATE
          SET state = 'pending', responded_at = NULL, updated_at = now()
          WHERE community_follow_requests.state = 'declined'
        RETURNING *
        `,
        [data.followerId, data.followeeId]
      );
      return result.rows[0] || null;
    },

    async hasPendingFollowRequest(followerId, followeeId) {
      const result = await db.query(
        `SELECT 1 FROM community_follow_requests WHERE follower_id = $1 AND followee_id = $2 AND state = 'pending'`,
        [followerId, followeeId]
      );
      return result.rowCount > 0;
    },

    async listFollowRequests(userId, { limit = 100 } = {}) {
      const result = await db.query(
        `
        SELECT fr.*, p.user_id, p.handle, p.display_name, p.avatar_url
        FROM community_follow_requests fr
        JOIN community_profiles p ON p.user_id = fr.follower_id
        WHERE fr.followee_id = $1 AND fr.state = 'pending'
        ORDER BY fr.created_at ASC
        LIMIT $2
        `,
        [userId, limit]
      );
      return result.rows;
    },

    async resolveFollowRequest(client, { followerId, followeeId, state }) {
      const result = await client.query(
        `
        UPDATE community_follow_requests
        SET state = $3, responded_at = now(), updated_at = now()
        WHERE follower_id = $1 AND followee_id = $2 AND state = 'pending'
        RETURNING *
        `,
        [followerId, followeeId, state]
      );
      return result.rows[0] || null;
    },

    async removeFollow(followerId, followeeId) {
      const result = await db.query(
        `DELETE FROM community_follows WHERE follower_id = $1 AND followee_id = $2 RETURNING id`,
        [followerId, followeeId]
      );
      return result.rowCount > 0;
    },

    async isFollowing(followerId, followeeId) {
      const result = await db.query(
        `SELECT 1 FROM community_follows WHERE follower_id = $1 AND followee_id = $2`,
        [followerId, followeeId]
      );
      return result.rows.length > 0;
    },

    async listFollowers(userId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT f.*, p.handle, p.display_name, p.avatar_url
        FROM community_follows f
        JOIN community_profiles p ON p.user_id = f.follower_id
        WHERE f.followee_id = $1
        ORDER BY f.created_at DESC
        LIMIT $2
        `,
        [userId, limit]
      );
      return result.rows;
    },

    async listFollowing(userId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT f.*, p.handle, p.display_name, p.avatar_url
        FROM community_follows f
        JOIN community_profiles p ON p.user_id = f.followee_id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC
        LIMIT $2
        `,
        [userId, limit]
      );
      return result.rows;
    },

    async countFollowers(userId) {
      const result = await db.query(
        `SELECT count(*)::int AS count FROM community_follows WHERE followee_id = $1`,
        [userId]
      );
      return result.rows[0].count;
    },

    async countFollowing(userId) {
      const result = await db.query(
        `SELECT count(*)::int AS count FROM community_follows WHERE follower_id = $1`,
        [userId]
      );
      return result.rows[0].count;
    },

    async insertBlock(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_blocks (blocker_id, blocked_id)
        VALUES ($1, $2)
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING
        RETURNING *
        `,
        [data.blockerId, data.blockedId]
      );
      return result.rows[0] || null;
    },

    async removeBlock(blockerId, blockedId) {
      const result = await db.query(
        `DELETE FROM community_blocks WHERE blocker_id = $1 AND blocked_id = $2 RETURNING id`,
        [blockerId, blockedId]
      );
      return result.rowCount > 0;
    },

    async isBlocked(blockerId, blockedId) {
      const result = await db.query(
        `SELECT 1 FROM community_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
        [blockerId, blockedId]
      );
      return result.rows.length > 0;
    },

    async listBlocks(blockerId) {
      const result = await db.query(
        `
        SELECT b.*, p.handle, p.display_name
        FROM community_blocks b
        JOIN community_profiles p ON p.user_id = b.blocked_id
        WHERE b.blocker_id = $1
        ORDER BY b.created_at DESC
        `,
        [blockerId]
      );
      return result.rows;
    },

    /* =========================================================================
     * POSTS
     * ====================================================================== */

    async insertPost(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_posts (
          author_id, destination_type, destination_ref_id, content, topics, visibility, allow_comments
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.authorId,
          data.destinationType,
          data.destinationRefId || null,
          data.content,
          data.topics || [],
          data.visibility || 'public',
          data.allowComments ?? true,
        ]
      );
      return result.rows[0];
    },

    async findPostById(postId) {
      const result = await db.query(
        `
        SELECT p.*,
               COALESCE(prof.handle, u.username_normalized, u.username) AS author_handle,
               COALESCE(prof.display_name, u.display_name) AS author_name,
               COALESCE(prof.avatar_url, u.avatar_url) AS author_avatar,
               COALESCE(prof.visibility, 'public') AS author_visibility
        FROM community_posts p
        JOIN users u ON u.id = p.author_id
        LEFT JOIN community_profiles prof ON prof.user_id = p.author_id
        WHERE p.id = $1 AND p.deleted_at IS NULL
        `,
        [postId]
      );
      return result.rows[0] || null;
    },

    async findPostBookmark(userId, postId) {
      if (!userId) return null;
      const result = await db.query(
        `
        SELECT id FROM community_saved_items
        WHERE user_id = $1 AND resource_type = 'post' AND resource_id = $2
        `,
        [userId, postId]
      );
      return result.rows[0] || null;
    },

    async hasReaction(userId, targetType, targetId) {
      if (!userId) return false;
      const result = await db.query(
        `
        SELECT 1 FROM community_reactions
        WHERE user_id = $1 AND target_type = $2 AND target_id = $3
        `,
        [userId, targetType, targetId]
      );
      return result.rowCount > 0;
    },

    async updatePost(postId, fields, client = db) {
      const result = await client.query(
        `
        UPDATE community_posts
        SET content = COALESCE($2, content),
            topics = COALESCE($3, topics),
            allow_comments = COALESCE($4, allow_comments),
            engagement = COALESCE($5, engagement),
            current_version = COALESCE($6, current_version),
            updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
        `,
        [
          postId,
          fields.content ?? null,
          fields.topics ?? null,
          fields.allowComments ?? null,
          fields.engagement ? JSON.stringify(fields.engagement) : null,
          fields.currentVersion ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async adjustPostCommentCount(postId, delta, client = db) {
      await client.query(
        `
        UPDATE community_posts
        SET engagement = jsonb_set(
              engagement,
              '{comments}',
              to_jsonb(GREATEST(0, COALESCE((engagement->>'comments')::integer, 0) + $2)),
              true
            ),
            updated_at = now()
        WHERE id = $1
        `,
        [postId, delta]
      );
    },

    async softDeletePost(postId) {
      const result = await db.query(
        `UPDATE community_posts SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        [postId]
      );
      return result.rowCount > 0;
    },

    async insertPostVersion(client, data) {
      await client.query(
        `
        INSERT INTO community_post_versions (post_id, version, content)
        VALUES ($1, $2, $3)
        ON CONFLICT (post_id, version) DO NOTHING
        `,
        [data.postId, data.version, data.content]
      );
    },

    async insertPostAttachment(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_post_attachments (post_id, type, storage_key, mime_type, size_bytes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [data.postId, data.type, data.storageKey, data.mimeType || null, data.sizeBytes || null]
      );
      return result.rows[0];
    },

    async insertPostPoll(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_post_polls (post_id, question, allow_multiple, closes_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.postId, data.question, data.allowMultiple, data.closesAt || null]
      );
      return result.rows[0];
    },

    async insertPollOption(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_poll_options (poll_post_id, position, label)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.postId, data.position, data.label]
      );
      return result.rows[0];
    },

    async getPollForPost(postId, viewerId = null, client = db) {
      const result = await client.query(
        `
        SELECT poll.post_id, poll.question, poll.allow_multiple, poll.closes_at,
               poll_option.id AS option_id, poll_option.label AS option_label,
               poll_option.position,
               count(vote.user_id)::int AS vote_count,
               COALESCE(bool_or(vote.user_id = $2), false) AS viewer_voted
        FROM community_post_polls poll
        JOIN community_poll_options poll_option ON poll_option.poll_post_id = poll.post_id
        LEFT JOIN community_poll_votes vote
          ON vote.poll_post_id = poll_option.poll_post_id AND vote.option_id = poll_option.id
        WHERE poll.post_id = $1
        GROUP BY poll.post_id, poll.question, poll.allow_multiple, poll.closes_at,
                 poll_option.id, poll_option.label, poll_option.position
        ORDER BY poll_option.position
        `,
        [postId, viewerId]
      );
      if (result.rows.length === 0) return null;
      const first = result.rows[0];
      return {
        question: first.question,
        allowMultiple: first.allow_multiple,
        closesAt: first.closes_at,
        options: result.rows.map((row) => ({
          id: row.option_id,
          label: row.option_label,
          position: row.position,
          voteCount: row.vote_count,
          viewerVoted: row.viewer_voted,
        })),
      };
    },

    async lockPoll(postId, client) {
      const result = await client.query(
        `SELECT * FROM community_post_polls WHERE post_id = $1 FOR UPDATE`,
        [postId]
      );
      return result.rows[0] || null;
    },

    async listPollOptionIds(postId, optionIds, client) {
      const result = await client.query(
        `SELECT id FROM community_poll_options WHERE poll_post_id = $1 AND id = ANY($2::uuid[])`,
        [postId, optionIds]
      );
      return result.rows.map((row) => row.id);
    },

    async replacePollVotes(client, postId, userId, optionIds) {
      await client.query(
        `DELETE FROM community_poll_votes WHERE poll_post_id = $1 AND user_id = $2`,
        [postId, userId]
      );
      for (const optionId of optionIds) {
        await client.query(
          `INSERT INTO community_poll_votes (poll_post_id, option_id, user_id) VALUES ($1, $2, $3)`,
          [postId, optionId, userId]
        );
      }
    },

    async insertPostEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_post_events (post_id, starts_at, ends_at, timezone, location, capacity)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.postId,
          data.startsAt,
          data.endsAt || null,
          data.timezone || 'UTC',
          data.location || null,
          data.capacity || null,
        ]
      );
      return result.rows[0];
    },

    async getEventForPost(postId, viewerId = null, client = db) {
      const result = await client.query(
        `
        SELECT event.*,
               count(rsvp.user_id) FILTER (WHERE rsvp.status = 'going')::int AS going_count,
               count(rsvp.user_id) FILTER (WHERE rsvp.status = 'interested')::int AS interested_count,
               (SELECT status FROM community_event_rsvps
                WHERE post_id = event.post_id AND user_id = $2) AS viewer_rsvp
        FROM community_post_events event
        LEFT JOIN community_event_rsvps rsvp ON rsvp.post_id = event.post_id
        WHERE event.post_id = $1
        GROUP BY event.post_id
        `,
        [postId, viewerId]
      );
      const row = result.rows[0];
      return row
        ? {
            startsAt: row.starts_at,
            endsAt: row.ends_at,
            timezone: row.timezone,
            location: row.location,
            capacity: row.capacity,
            goingCount: row.going_count,
            interestedCount: row.interested_count,
            viewerRsvp: row.viewer_rsvp,
          }
        : null;
    },

    async lockEvent(postId, client) {
      const result = await client.query(
        `SELECT * FROM community_post_events WHERE post_id = $1 FOR UPDATE`,
        [postId]
      );
      return result.rows[0] || null;
    },

    async countGoingRsvps(postId, client) {
      const result = await client.query(
        `SELECT count(*)::int AS count FROM community_event_rsvps WHERE post_id = $1 AND status = 'going'`,
        [postId]
      );
      return result.rows[0]?.count || 0;
    },

    async upsertEventRsvp(client, postId, userId, status) {
      const result = await client.query(
        `
        INSERT INTO community_event_rsvps (post_id, user_id, status)
        VALUES ($1, $2, $3)
        ON CONFLICT (post_id, user_id)
        DO UPDATE SET status = EXCLUDED.status, updated_at = now()
        RETURNING *
        `,
        [postId, userId, status]
      );
      return result.rows[0];
    },

    async findEventRsvp(postId, userId, client = db) {
      const result = await client.query(
        `SELECT * FROM community_event_rsvps WHERE post_id = $1 AND user_id = $2`,
        [postId, userId]
      );
      return result.rows[0] || null;
    },

    async insertMarketIdea(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_market_ideas (
          post_id, instrument, market_type, direction, timeframe, thesis,
          entry_price, stop_loss, take_profit, invalidation
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        `,
        [
          data.postId,
          data.instrument,
          data.marketType,
          data.direction,
          data.timeframe,
          data.thesis,
          data.entryPrice || null,
          data.stopLoss || null,
          data.takeProfit || null,
          data.invalidation || null,
        ]
      );
      return result.rows[0];
    },

    async getMarketIdeaForPost(postId, client = db) {
      const result = await client.query(
        `SELECT * FROM community_market_ideas WHERE post_id = $1`,
        [postId]
      );
      const row = result.rows[0];
      return row
        ? {
            instrument: row.instrument,
            marketType: row.market_type,
            direction: row.direction,
            timeframe: row.timeframe,
            thesis: row.thesis,
            entryPrice: row.entry_price,
            stopLoss: row.stop_loss,
            takeProfit: row.take_profit,
            invalidation: row.invalidation,
          }
        : null;
    },

    async listPostAttachments(postId) {
      const result = await db.query(
        `SELECT * FROM community_post_attachments WHERE post_id = $1`,
        [postId]
      );
      return result.rows;
    },

    async listFeedPosts({
      userId,
      followingOnly = false,
      limit = 50,
      cursor = null,
    } = {}) {
      const params = [limit + 1];
      const conditions = [
        'p.deleted_at IS NULL',
        "p.destination_type = 'public_feed'",
      ];
      let viewerParam = null;
      if (userId) {
        params.push(userId);
        viewerParam = `$${params.length}`;
        conditions.push(`NOT EXISTS (
          SELECT 1 FROM community_blocks b
          WHERE (b.blocker_id = ${viewerParam} AND b.blocked_id = p.author_id)
             OR (b.blocked_id = ${viewerParam} AND b.blocker_id = p.author_id)
        )`);
      }

      if (followingOnly) {
        params.push(userId);
        const followingParam = `$${params.length}`;
        conditions.push(
          `(p.author_id = ${followingParam} OR p.visibility = 'public' OR (
            p.visibility = 'followers' AND (
              p.author_id = ${followingParam}
              OR EXISTS (
                SELECT 1 FROM community_follows f
                WHERE f.follower_id = ${followingParam} AND f.followee_id = p.author_id
              )
            )
          ))`
        );
        conditions.push(
          `(p.author_id = ${followingParam} OR EXISTS (
            SELECT 1 FROM community_follows f
            WHERE f.follower_id = ${followingParam} AND f.followee_id = p.author_id
          ))`
        );
      } else {
        conditions.push("p.visibility = 'public'");
      }

      if (viewerParam) {
        conditions.push(`(
          COALESCE(prof.visibility, 'public') = 'public'
          OR (
            COALESCE(prof.visibility, 'public') IN ('followers', 'private')
            AND (
              p.author_id = ${viewerParam}
              OR EXISTS (
                SELECT 1 FROM community_follows f
                WHERE f.follower_id = ${viewerParam} AND f.followee_id = p.author_id
              )
            )
          )
        )`);
      } else {
        conditions.push(`COALESCE(prof.visibility, 'public') = 'public'`);
      }

      if (cursor) {
        params.push(cursor);
        conditions.push(`p.created_at < $${params.length}`);
      }

      const result = await db.query(
        `
        SELECT p.*,
               COALESCE(prof.handle, u.username_normalized, u.username) AS author_handle,
               COALESCE(prof.display_name, u.display_name) AS author_name,
               COALESCE(prof.avatar_url, u.avatar_url) AS author_avatar,
               (SELECT count(*)::int FROM community_reactions r
                WHERE r.target_type = 'post' AND r.target_id = p.id) AS reaction_count,
               ${viewerParam ? `(SELECT r.reaction_type FROM community_reactions r
                 WHERE r.user_id = ${viewerParam} AND r.target_type = 'post' AND r.target_id = p.id
                 LIMIT 1)` : 'NULL'} AS viewer_reaction,
               ${viewerParam ? `(SELECT s.id FROM community_saved_items s
                 WHERE s.user_id = ${viewerParam} AND s.resource_type = 'post' AND s.resource_id = p.id
                 LIMIT 1)` : 'NULL'} AS bookmark_id
        FROM community_posts p
        JOIN users u ON u.id = p.author_id
        LEFT JOIN community_profiles prof ON prof.user_id = p.author_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.created_at DESC
        LIMIT $1
        `,
        params
      );

      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.created_at.toISOString() : null,
      };
    },

    async listPostsByAuthor({
      authorId,
      viewerId = null,
      limit = 50,
      cursor = null,
    }) {
      const params = [authorId, limit + 1];
      const conditions = ['p.author_id = $1', 'p.deleted_at IS NULL'];
      let viewerParam = null;

      if (viewerId !== authorId) {
        if (viewerId) {
          params.push(viewerId);
          viewerParam = `$${params.length}`;
        }
        const viewerReference = viewerParam || 'NULL';
        conditions.push(`(
          COALESCE(prof.visibility, 'public') = 'public'
          OR (COALESCE(prof.visibility, 'public') IN ('followers', 'private') AND EXISTS (
            SELECT 1 FROM community_follows f
            WHERE f.follower_id = ${viewerReference} AND f.followee_id = p.author_id
          ))
        )`);
        conditions.push(`NOT EXISTS (
          SELECT 1 FROM community_blocks b
          WHERE (b.blocker_id = ${viewerReference} AND b.blocked_id = p.author_id)
             OR (b.blocked_id = ${viewerReference} AND b.blocker_id = p.author_id)
        )`);
        conditions.push(`(
          (p.destination_type = 'public_feed' AND (
            p.visibility = 'public'
            OR (p.visibility = 'followers' AND EXISTS (
              SELECT 1 FROM community_follows
              WHERE follower_id = ${viewerReference} AND followee_id = $1
            ))
          ))
          OR (p.destination_type = 'group' AND EXISTS (
            SELECT 1 FROM community_group_memberships gm
            WHERE gm.group_id = p.destination_ref_id
              AND gm.user_id = ${viewerReference}
              AND gm.state = 'active'
          ) AND (
            p.visibility IN ('public', 'group_members')
            OR (p.visibility = 'followers' AND EXISTS (
              SELECT 1 FROM community_follows
              WHERE follower_id = ${viewerReference} AND followee_id = p.author_id
            ))
          ))
        )`);
      }
      if (viewerId === authorId && viewerId) {
        params.push(viewerId);
        viewerParam = `$${params.length}`;
      }

      if (cursor) {
        params.push(cursor);
        conditions.push(`p.created_at < $${params.length}`);
      }

      const result = await db.query(
        `
        SELECT p.*,
               COALESCE(prof.handle, u.username_normalized, u.username) AS author_handle,
               COALESCE(prof.display_name, u.display_name) AS author_name,
               COALESCE(prof.avatar_url, u.avatar_url) AS author_avatar,
               (SELECT count(*)::int FROM community_reactions r
                WHERE r.target_type = 'post' AND r.target_id = p.id) AS reaction_count,
               ${viewerParam ? `(SELECT r.reaction_type FROM community_reactions r
                 WHERE r.user_id = ${viewerParam} AND r.target_type = 'post' AND r.target_id = p.id
                 LIMIT 1)` : 'NULL'} AS viewer_reaction,
               ${viewerParam ? `(SELECT s.id FROM community_saved_items s
                 WHERE s.user_id = ${viewerParam} AND s.resource_type = 'post' AND s.resource_id = p.id
                 LIMIT 1)` : 'NULL'} AS bookmark_id
        FROM community_posts p
        JOIN users u ON u.id = p.author_id
        LEFT JOIN community_profiles prof ON prof.user_id = p.author_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.created_at DESC
        LIMIT $2
        `,
        params
      );

      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.created_at.toISOString() : null,
      };
    },

    async listGroupPosts({
      groupId,
      viewerId,
      allowPublic = false,
      limit = 50,
      cursor = null,
    }) {
      const params = [groupId, limit + 1, viewerId, allowPublic];
      const conditions = [
        'p.destination_type = \'group\'',
        'p.destination_ref_id = $1',
        'p.deleted_at IS NULL',
        `NOT EXISTS (
          SELECT 1 FROM community_blocks b
          WHERE (b.blocker_id = $3 AND b.blocked_id = p.author_id)
             OR (b.blocked_id = $3 AND b.blocker_id = p.author_id)
        )`,
        `(
          ($4::boolean AND p.visibility = 'public'
            AND COALESCE(prof.visibility, 'public') = 'public')
          OR (
            EXISTS (
              SELECT 1 FROM community_group_memberships gm
              WHERE gm.group_id = $1 AND gm.user_id = $3 AND gm.state = 'active'
            )
            AND (
              COALESCE(prof.visibility, 'public') = 'public'
              OR (COALESCE(prof.visibility, 'public') IN ('followers', 'private')
                AND (p.author_id = $3 OR EXISTS (
                  SELECT 1 FROM community_follows f
                  WHERE f.follower_id = $3 AND f.followee_id = p.author_id
                )))
            )
            AND (
              p.visibility IN ('public', 'group_members')
              OR (p.visibility = 'followers' AND (
                p.author_id = $3 OR EXISTS (
                  SELECT 1 FROM community_follows f
                  WHERE f.follower_id = $3 AND f.followee_id = p.author_id
                )
              ))
            )
          )
        )`,
      ];
      if (cursor) {
        params.push(cursor);
        conditions.push(`p.created_at < $${params.length}`);
      }

      const result = await db.query(
        `
        SELECT p.*,
               COALESCE(prof.handle, u.username_normalized, u.username) AS author_handle,
               COALESCE(prof.display_name, u.display_name) AS author_name,
               COALESCE(prof.avatar_url, u.avatar_url) AS author_avatar,
               (SELECT count(*)::int FROM community_reactions r
                WHERE r.target_type = 'post' AND r.target_id = p.id) AS reaction_count,
               (SELECT r.reaction_type FROM community_reactions r
                WHERE r.user_id = $3 AND r.target_type = 'post' AND r.target_id = p.id
                LIMIT 1) AS viewer_reaction,
               (SELECT s.id FROM community_saved_items s
                WHERE s.user_id = $3 AND s.resource_type = 'post' AND s.resource_id = p.id
                LIMIT 1) AS bookmark_id
        FROM community_posts p
        JOIN users u ON u.id = p.author_id
        LEFT JOIN community_profiles prof ON prof.user_id = p.author_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.created_at DESC
        LIMIT $2
        `,
        params
      );

      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.created_at.toISOString() : null,
      };
    },

    /* =========================================================================
     * COMMENTS
     * ====================================================================== */

    async insertComment(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_comments (post_id, parent_id, author_id, content)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.postId, data.parentId || null, data.authorId, data.content]
      );
      return result.rows[0];
    },

    async findCommentById(commentId) {
      const result = await db.query(
        `SELECT * FROM community_comments WHERE id = $1 AND deleted_at IS NULL`,
        [commentId]
      );
      return result.rows[0] || null;
    },

    async listCommentsForPost(postId, { limit = 200 } = {}) {
      const result = await db.query(
        `
        SELECT c.*,
               COALESCE(prof.handle, u.username_normalized, u.username) AS author_handle,
               COALESCE(prof.display_name, u.display_name) AS author_name,
               COALESCE(prof.avatar_url, u.avatar_url) AS author_avatar
        FROM community_comments c
        JOIN users u ON u.id = c.author_id
        LEFT JOIN community_profiles prof ON prof.user_id = c.author_id
        WHERE c.post_id = $1 AND c.deleted_at IS NULL
        ORDER BY c.created_at ASC
        LIMIT $2
        `,
        [postId, limit]
      );
      return result.rows;
    },

    async softDeleteComment(commentId, client = db) {
      const result = await client.query(
        `UPDATE community_comments SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        [commentId]
      );
      return result.rowCount > 0;
    },

    async insertCommentVersion(client, data) {
      await client.query(
        `
        INSERT INTO community_comment_versions (comment_id, version, content)
        VALUES ($1, $2, $3)
        ON CONFLICT (comment_id, version) DO NOTHING
        `,
        [data.commentId, data.version, data.content]
      );
    },

    /* =========================================================================
     * REACTIONS
     * ====================================================================== */

    async upsertReaction(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_reactions (user_id, target_type, target_id, reaction_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET reaction_type = EXCLUDED.reaction_type
        RETURNING *
        `,
        [data.userId, data.targetType, data.targetId, data.reactionType || 'like']
      );
      return result.rows[0];
    },

    async deleteReaction(userId, targetType, targetId) {
      const result = await db.query(
        `DELETE FROM community_reactions WHERE user_id = $1 AND target_type = $2 AND target_id = $3 RETURNING id`,
        [userId, targetType, targetId]
      );
      return result.rowCount > 0;
    },

    async countReactions(targetType, targetId) {
      const result = await db.query(
        `SELECT count(*)::int AS count FROM community_reactions WHERE target_type = $1 AND target_id = $2`,
        [targetType, targetId]
      );
      return result.rows[0].count;
    },

    /* =========================================================================
     * GROUPS
     * ====================================================================== */

    async insertGroup(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_groups (owner_id, workspace_id, name, slug, description, type, visibility)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.ownerId,
          data.workspaceId || null,
          data.name,
          data.slug,
          data.description || null,
          data.type,
          data.visibility,
        ]
      );
      return result.rows[0];
    },

    async findGroupById(groupId) {
      const result = await db.query(
        `SELECT * FROM community_groups WHERE id = $1`,
        [groupId]
      );
      return result.rows[0] || null;
    },

    async findGroupBySlug(slug) {
      const result = await db.query(
        `SELECT * FROM community_groups WHERE slug = $1`,
        [slug]
      );
      return result.rows[0] || null;
    },

    async listPublicGroups({
      userId = null,
      filter = 'all',
      query = null,
      limit = 50,
      cursor = null,
    } = {}) {
      const params = [];
      let memberCheck = 'false';
      if (userId) {
        params.push(userId);
        memberCheck = `(
          g.owner_id = $${params.length}
          OR EXISTS (
            SELECT 1 FROM community_group_memberships gm
            WHERE gm.group_id = g.id
              AND gm.user_id = $${params.length}
              AND gm.state = 'active'
          )
        )`;
      }
      const conditions = [];
      if (filter === 'mine') {
        conditions.push(memberCheck);
      } else if (filter === 'public') {
        conditions.push("g.type IN ('public', 'approval_based')");
      } else if (filter === 'private') {
        conditions.push(`g.type IN ('private', 'organization') AND ${memberCheck}`);
      } else {
        conditions.push(`(g.type IN ('public', 'approval_based') OR ${memberCheck})`);
      }
      if (query) {
        params.push(`%${query}%`);
        conditions.push(`(g.name ILIKE $${params.length} OR COALESCE(g.description, '') ILIKE $${params.length})`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`g.created_at < $${params.length}`);
      }
      params.push(limit + 1);
      const limitParam = params.length;
      const result = await db.query(
        `
        SELECT g.*,
               ${userId ? `(${memberCheck})` : 'false'} AS viewer_is_member
        FROM community_groups g
        WHERE ${conditions.join(' AND ')}
        ORDER BY g.created_at DESC
        LIMIT $${limitParam}
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.created_at.toISOString() : null,
      };
    },

    async updateGroup(groupId, fields) {
      const result = await db.query(
        `
        UPDATE community_groups
        SET name = COALESCE($2, name),
            description = COALESCE($3, description),
            type = COALESCE($4, type),
            visibility = COALESCE($5, visibility),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          groupId,
          fields.name ?? null,
          fields.description ?? null,
          fields.type ?? null,
          fields.visibility ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async incrementGroupMemberCount(groupId, delta, client = db) {
      await client.query(
        `
        UPDATE community_groups
        SET member_count = GREATEST(0, member_count + $2)
        WHERE id = $1
        `,
        [groupId, delta]
      );
    },

    async insertGroupMembership(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_group_memberships (group_id, user_id, state)
        VALUES ($1, $2, $3)
        ON CONFLICT (group_id, user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()
        RETURNING *
        `,
        [data.groupId, data.userId, data.state || 'active']
      );
      return result.rows[0];
    },

    async findGroupMembership(groupId, userId) {
      const result = await db.query(
        `SELECT * FROM community_group_memberships WHERE group_id = $1 AND user_id = $2`,
        [groupId, userId]
      );
      return result.rows[0] || null;
    },

    async findGroupRole(groupId, userId) {
      const result = await db.query(
        `SELECT role FROM community_group_roles WHERE group_id = $1 AND user_id = $2`,
        [groupId, userId]
      );
      return result.rows[0]?.role || null;
    },

    async setGroupRole(client, { groupId, userId, role }) {
      const result = await client.query(
        `
        INSERT INTO community_group_roles (group_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role
        RETURNING *
        `,
        [groupId, userId, role]
      );
      return result.rows[0];
    },

    async listGroupRequests(groupId, { limit = 100 } = {}) {
      const result = await db.query(
        `
        SELECT m.*, p.handle, p.display_name, p.avatar_url
        FROM community_group_memberships m
        JOIN community_profiles p ON p.user_id = m.user_id
        WHERE m.group_id = $1 AND m.state = 'requested'
        ORDER BY m.created_at ASC
        LIMIT $2
        `,
        [groupId, limit]
      );
      return result.rows;
    },

    async resolveGroupRequest(client, { groupId, userId, state }) {
      const result = await client.query(
        `
        UPDATE community_group_memberships
        SET state = $3, updated_at = now()
        WHERE group_id = $1 AND user_id = $2 AND state = 'requested'
        RETURNING *
        `,
        [groupId, userId, state]
      );
      return result.rows[0] || null;
    },

    async changeGroupMemberState(client, { groupId, userId, state }) {
      const result = await client.query(
        `
        UPDATE community_group_memberships
        SET state = $3, updated_at = now()
        WHERE group_id = $1 AND user_id = $2 AND state = 'active'
        RETURNING *
        `,
        [groupId, userId, state]
      );
      return result.rows[0] || null;
    },

    async listGroupMembers(groupId, { limit = 100, viewerId = null } = {}) {
      const params = [groupId, limit];
      let visibilityClause = '';
      if (viewerId) {
        params.push(viewerId);
        visibilityClause = `AND NOT EXISTS (
          SELECT 1 FROM community_blocks b
          WHERE (b.blocker_id = $${params.length} AND b.blocked_id = m.user_id)
             OR (b.blocked_id = $${params.length} AND b.blocker_id = m.user_id)
        )`;
      }
      const result = await db.query(
        `
        SELECT m.*, p.handle, p.display_name, p.avatar_url, r.role
        FROM community_group_memberships m
        JOIN community_profiles p ON p.user_id = m.user_id
        LEFT JOIN community_group_roles r
          ON r.group_id = m.group_id AND r.user_id = m.user_id
        WHERE m.group_id = $1 AND m.state = 'active' ${visibilityClause}
        ORDER BY m.created_at ASC
        LIMIT $2
        `,
        params
      );
      return result.rows;
    },

    /* =========================================================================
     * DISCUSSIONS (workspace)
     * ====================================================================== */

    async insertChannel(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_channels (group_id, workspace_id, name, kind)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.groupId || null, data.workspaceId || null, data.name, data.kind || 'general']
      );
      return result.rows[0];
    },

    async findChannelById(channelId) {
      const result = await db.query(
        `SELECT * FROM community_channels WHERE id = $1`,
        [channelId]
      );
      return result.rows[0] || null;
    },

    async listChannelsForWorkspace(workspaceId) {
      const result = await db.query(
        `SELECT * FROM community_channels WHERE workspace_id = $1 ORDER BY created_at ASC`,
        [workspaceId]
      );
      return result.rows;
    },

    async insertDiscussionThread(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_discussion_threads (channel_id, title, created_by)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.channelId, data.title, data.createdBy]
      );
      return result.rows[0];
    },

    async findDiscussionThreadById(threadId) {
      const result = await db.query(
        `
        SELECT t.*, c.workspace_id, c.group_id
        FROM community_discussion_threads t
        JOIN community_channels c ON c.id = t.channel_id
        WHERE t.id = $1
        `,
        [threadId]
      );
      return result.rows[0] || null;
    },

    async listDiscussionThreads(channelId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT t.*,
               COALESCE(p.handle, u.username_normalized, u.username) AS creator_handle,
               COALESCE(p.display_name, u.display_name) AS creator_name
        FROM community_discussion_threads t
        JOIN users u ON u.id = t.created_by
        LEFT JOIN community_profiles p ON p.user_id = t.created_by
        WHERE t.channel_id = $1
        ORDER BY t.updated_at DESC
        LIMIT $2
        `,
        [channelId, limit]
      );
      return result.rows;
    },

    async insertDiscussionMessage(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_discussion_messages (thread_id, author_id, content)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.threadId, data.authorId, data.content]
      );
      return result.rows[0];
    },

    async listDiscussionMessages(threadId, { limit = 200 } = {}) {
      const result = await db.query(
        `
        SELECT m.*,
               COALESCE(p.handle, u.username_normalized, u.username) AS author_handle,
               COALESCE(p.display_name, u.display_name) AS author_name,
               COALESCE(p.avatar_url, u.avatar_url) AS author_avatar
        FROM community_discussion_messages m
        JOIN users u ON u.id = m.author_id
        LEFT JOIN community_profiles p ON p.user_id = m.author_id
        WHERE m.thread_id = $1 AND m.deleted_at IS NULL
        ORDER BY m.created_at ASC
        LIMIT $2
        `,
        [threadId, limit]
      );
      return result.rows;
    },

    /* =========================================================================
     * ANALYSIS DOCUMENTS
     * ====================================================================== */

    async insertAnalysisDocument(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_analysis_documents (
          author_id, workspace_id, title, summary, tags, visibility
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.authorId,
          data.workspaceId || null,
          data.title,
          data.summary || null,
          data.tags || [],
          data.visibility || 'private',
        ]
      );
      return result.rows[0];
    },

    async findAnalysisDocumentById(documentId) {
      const result = await db.query(
        `
        SELECT d.*, p.handle AS author_handle, p.display_name AS author_name
        FROM community_analysis_documents d
        JOIN community_profiles p ON p.user_id = d.author_id
        WHERE d.id = $1
        `,
        [documentId]
      );
      return result.rows[0] || null;
    },

    async listAnalysisDocuments({ userId, workspaceId, query, limit = 50, cursor = null }) {
      const params = [userId, workspaceId, limit + 1];
      const conditions = [
        `NOT EXISTS (
          SELECT 1 FROM community_blocks b
          WHERE (b.blocker_id = $1 AND b.blocked_id = d.author_id)
             OR (b.blocked_id = $1 AND b.blocker_id = d.author_id)
        )`,
        `(
          d.author_id = $1
          OR d.visibility = 'public'
          OR (d.visibility = 'followers' AND EXISTS (
            SELECT 1 FROM community_follows f
            WHERE f.follower_id = $1 AND f.followee_id = d.author_id
          ))
          OR (d.visibility = 'workspace_members' AND d.workspace_id = $2)
          OR EXISTS (
            SELECT 1 FROM community_analysis_permissions ap
            WHERE ap.document_id = d.id
              AND (ap.grantee_user_id = $1 OR ap.grantee_workspace_id = $2)
          )
        )`,
      ];
      if (query) {
        params.push(`%${query}%`);
        conditions.push(`(d.title ILIKE $${params.length} OR COALESCE(d.summary, '') ILIKE $${params.length})`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`d.created_at < $${params.length}`);
      }

      const result = await db.query(
        `
        SELECT d.*, p.handle AS author_handle, p.display_name AS author_name
        FROM community_analysis_documents d
        JOIN community_profiles p ON p.user_id = d.author_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY d.created_at DESC
        LIMIT $3
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.created_at.toISOString() : null,
      };
    },

    async findAnalysisVersionContent(documentId, version) {
      const result = await db.query(
        `SELECT content FROM community_analysis_versions WHERE document_id = $1 AND version = $2`,
        [documentId, version]
      );
      return result.rows[0]?.content ?? null;
    },

    async listAnalysisSources(documentId) {
      const result = await db.query(
        `SELECT * FROM community_analysis_sources WHERE document_id = $1 ORDER BY created_at`,
        [documentId]
      );
      return result.rows;
    },

    async insertAnalysisVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_analysis_versions (document_id, version, content)
        VALUES ($1, $2, $3)
        ON CONFLICT (document_id, version) DO NOTHING
        RETURNING *
        `,
        [data.documentId, data.version, data.content]
      );
      return result.rows[0] || null;
    },

    async listAnalysisVersions(documentId) {
      const result = await db.query(
        `
        SELECT * FROM community_analysis_versions
        WHERE document_id = $1
        ORDER BY version DESC
        `,
        [documentId]
      );
      return result.rows;
    },

    async insertAnalysisPermission(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_analysis_permissions (
          document_id, grantee_user_id, grantee_workspace_id, permission
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          data.documentId,
          data.granteeUserId || null,
          data.granteeWorkspaceId || null,
          data.permission,
        ]
      );
      return result.rows[0];
    },

    async findAnalysisPermission(documentId, userId, workspaceId) {
      const result = await db.query(
        `
        SELECT * FROM community_analysis_permissions
        WHERE document_id = $1 AND (grantee_user_id = $2 OR grantee_workspace_id = $3)
        ORDER BY CASE permission
          WHEN 'manage_sharing' THEN 5
          WHEN 'edit' THEN 4
          WHEN 'comment' THEN 3
          WHEN 'view' THEN 2
          ELSE 1
        END DESC
        LIMIT 1
        `,
        [documentId, userId, workspaceId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * BOOKMARKS
     * ====================================================================== */

    async insertBookmark(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_saved_items (user_id, resource_type, resource_id, collection, note)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, resource_type, resource_id) DO NOTHING
        RETURNING *
        `,
        [data.userId, data.resourceType, data.resourceId, data.collection || null, data.note || null]
      );
      return result.rows[0] || null;
    },

    async removeBookmark(userId, bookmarkId) {
      const result = await db.query(
        `DELETE FROM community_saved_items WHERE id = $1 AND user_id = $2 RETURNING id`,
        [bookmarkId, userId]
      );
      return result.rowCount > 0;
    },

    async listBookmarks(userId, { limit = 100 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM community_saved_items
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        `,
        [userId, limit]
      );
      return result.rows;
    },

    /* =========================================================================
     * RECOMMENDATIONS
     * ====================================================================== */

    async insertRecommendation(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_ai_recommendations (
          user_id, recommendation_type, target_ref, explanation, score, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.userId,
          data.recommendationType,
          JSON.stringify(data.targetRef),
          data.explanation,
          data.score || null,
          data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ]
      );
      return result.rows[0];
    },

    async listActiveRecommendations(userId, { type, limit = 20 } = {}) {
      const params = [userId, limit];
      let typeClause = '';
      if (type) {
        params.push(type);
        typeClause = `AND recommendation_type = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM community_ai_recommendations
        WHERE user_id = $1 ${typeClause} AND expires_at > now()
        ORDER BY score DESC NULLS LAST, created_at DESC
        LIMIT $2
        `,
        params
      );
      return result.rows;
    },

    async findRecommendationForUser(recommendationId, userId) {
      const result = await db.query(
        `SELECT * FROM community_ai_recommendations WHERE id = $1 AND user_id = $2`,
        [recommendationId, userId]
      );
      return result.rows[0] || null;
    },

    async insertRecommendationFeedback(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_recommendation_feedback (recommendation_id, user_id, feedback)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.recommendationId, data.userId, data.feedback]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * SEARCH
     * ====================================================================== */

    async searchPosts({ query, userId, limit = 50 }) {
      const result = await db.query(
        `
        SELECT p.*,
               COALESCE(prof.handle, u.username_normalized, u.username) AS author_handle,
               COALESCE(prof.display_name, u.display_name) AS author_name,
               COALESCE(prof.avatar_url, u.avatar_url) AS author_avatar,
               (SELECT count(*)::int FROM community_reactions r
                WHERE r.target_type = 'post' AND r.target_id = p.id) AS reaction_count
        FROM community_posts p
        JOIN users u ON u.id = p.author_id
        LEFT JOIN community_profiles prof ON prof.user_id = p.author_id
        WHERE p.deleted_at IS NULL
          AND p.destination_type = 'public_feed'
          AND p.visibility = 'public'
          AND COALESCE(prof.visibility, 'public') = 'public'
          AND NOT EXISTS (
            SELECT 1 FROM community_blocks b
            WHERE (b.blocker_id = $2 AND b.blocked_id = p.author_id)
               OR (b.blocked_id = $2 AND b.blocker_id = p.author_id)
          )
          AND to_tsvector('english', p.content) @@ plainto_tsquery('english', $1)
        ORDER BY p.created_at DESC
        LIMIT $3
        `,
        [query, userId, limit]
      );
      return result.rows;
    },

    async searchProfiles({ query, userId, limit = 50 }) {
      const result = await db.query(
        `
        SELECT COALESCE(p.id, u.id) AS id,
               u.id AS user_id,
               COALESCE(p.handle, u.username_normalized, u.username) AS handle,
               COALESCE(p.display_name, u.display_name) AS display_name,
               p.biography,
               COALESCE(p.avatar_url, u.avatar_url) AS avatar_url,
               COALESCE(p.interests, '{}') AS interests,
               COALESCE(p.skills, '{}') AS skills,
               p.website,
               COALESCE(p.visibility, 'public') AS visibility,
               COALESCE(p.created_at, u.created_at) AS created_at
        FROM users u
        LEFT JOIN community_profiles p ON p.user_id = u.id
        WHERE u.deleted_at IS NULL
          AND u.status NOT IN ('suspended', 'deletion_pending', 'deleted')
          AND COALESCE(p.visibility, 'public') = 'public'
          AND u.id <> $1
          AND NOT EXISTS (
            SELECT 1 FROM community_blocks b
            WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
               OR (b.blocked_id = $1 AND b.blocker_id = u.id)
          )
          AND (
            $2 = '' OR
            COALESCE(p.display_name, u.display_name) ILIKE $2 OR
            COALESCE(p.handle, u.username_normalized, u.username) ILIKE $2 OR
            p.biography ILIKE $2
          )
        ORDER BY COALESCE(p.created_at, u.created_at) DESC
        LIMIT $3
        `,
        [userId, query ? `%${query}%` : '', limit]
      );
      return result.rows;
    },

    async searchGroups({ query, limit = 50 }) {
      const result = await db.query(
        `
        SELECT * FROM community_groups
        WHERE type IN ('public', 'approval_based')
          AND (name ILIKE $1 OR description ILIKE $1)
        ORDER BY member_count DESC, created_at DESC
        LIMIT $2
        `,
        [`%${query}%`, limit]
      );
      return result.rows;
    },

    async insertSearchEvent(client, data) {
      await client.query(
        `
        INSERT INTO community_search_events (user_id, query_text, result_count, filters)
        VALUES ($1, $2, $3, $4)
        `,
        [data.userId || null, data.queryText, data.resultCount, data.filters ? JSON.stringify(data.filters) : null]
      );
    },

    /* =========================================================================
     * MODERATION
     * ====================================================================== */

    async insertModerationCase(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_moderation_cases (
          reporter_id, resource_type, resource_id, reason, details
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.reporterId,
          data.resourceType,
          data.resourceId,
          data.reason,
          data.details || null,
        ]
      );
      return result.rows[0];
    },

    async findModerationCaseById(caseId) {
      const result = await db.query(
        `SELECT * FROM community_moderation_cases WHERE id = $1`,
        [caseId]
      );
      return result.rows[0] || null;
    },

    async updateModerationCase(caseId, fields, client = db, expectedStates = null) {
      const result = await client.query(
        `
        UPDATE community_moderation_cases
        SET state = COALESCE($2, state),
            assigned_to = COALESCE($3, assigned_to),
            resolved_at = COALESCE($4, resolved_at)
        WHERE id = $1
          AND ($5::text[] IS NULL OR state = ANY($5::text[]))
        RETURNING *
        `,
        [
          caseId,
          fields.state ?? null,
          fields.assignedTo ?? null,
          fields.resolvedAt ?? null,
          expectedStates,
        ]
      );
      return result.rows[0] || null;
    },

    async listModerationCases({ state, limit = 50, cursor = null } = {}) {
      const params = [limit + 1];
      const conditions = [];
      if (state) {
        params.push(state);
        conditions.push(`state = $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`opened_at < $${params.length}`);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await db.query(
        `
        SELECT * FROM community_moderation_cases
        ${where}
        ORDER BY opened_at DESC
        LIMIT $1
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.opened_at.toISOString() : null,
      };
    },

    async listModerationCasesForOwner(userId, { limit = 50, cursor = null } = {}) {
      const params = [userId, limit + 1];
      let cursorClause = '';
      if (cursor) {
        params.push(cursor);
        cursorClause = `AND moderation_case.opened_at < $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT moderation_case.*,
               appeal.id AS appeal_id,
               appeal.status AS appeal_status
        FROM community_moderation_cases moderation_case
        LEFT JOIN LATERAL (
          SELECT id, status FROM community_moderation_appeals
          WHERE case_id = moderation_case.id AND appellant_id = $1
          ORDER BY created_at DESC LIMIT 1
        ) appeal ON true
        WHERE (
          (moderation_case.resource_type = 'post' AND EXISTS (
            SELECT 1 FROM community_posts
            WHERE id = moderation_case.resource_id AND author_id = $1
          ))
          OR (moderation_case.resource_type = 'comment' AND EXISTS (
            SELECT 1 FROM community_comments
            WHERE id = moderation_case.resource_id AND author_id = $1
          ))
          OR (moderation_case.resource_type = 'profile' AND EXISTS (
            SELECT 1 FROM community_profiles
            WHERE id = moderation_case.resource_id AND user_id = $1
          ))
          OR (moderation_case.resource_type = 'group' AND EXISTS (
            SELECT 1 FROM community_groups
            WHERE id = moderation_case.resource_id AND owner_id = $1
          ))
          OR (moderation_case.resource_type = 'analysis' AND EXISTS (
            SELECT 1 FROM community_analysis_documents
            WHERE id = moderation_case.resource_id AND author_id = $1
          ))
        )
        ${cursorClause}
        ORDER BY moderation_case.opened_at DESC, moderation_case.id DESC
        LIMIT $2
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.opened_at.toISOString() : null,
      };
    },

    async listModerationCasesByReporter(userId, { limit = 50, cursor = null } = {}) {
      const params = [userId, limit + 1];
      let cursorClause = '';
      if (cursor) {
        params.push(cursor);
        cursorClause = `AND opened_at < $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM community_moderation_cases
        WHERE reporter_id = $1 ${cursorClause}
        ORDER BY opened_at DESC, id DESC
        LIMIT $2
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.opened_at.toISOString() : null,
      };
    },

    async insertModerationAction(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_moderation_actions (case_id, actor_id, action, reason)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.caseId, data.actorId, data.action, data.reason || null]
      );
      return result.rows[0];
    },

    async insertModerationAppeal(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_moderation_appeals (case_id, appellant_id, reason)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.caseId, data.appellantId, data.reason]
      );
      return result.rows[0];
    },

    async findPendingModerationAppeal(caseId, appellantId, client = db) {
      const result = await client.query(
        `SELECT id FROM community_moderation_appeals WHERE case_id = $1 AND appellant_id = $2 AND status = 'pending'`,
        [caseId, appellantId]
      );
      return result.rows[0] || null;
    },

    async updateModerationAppeal(appealId, fields, client = db) {
      const result = await client.query(
        `
        UPDATE community_moderation_appeals
        SET status = $2, resolved_at = now(), resolution = $3
        WHERE id = $1 AND status = 'pending'
        RETURNING *
        `,
        [appealId, fields.status, fields.resolution]
      );
      return result.rows[0] || null;
    },

    async findModerationAppealById(appealId) {
      const result = await db.query(
        `SELECT * FROM community_moderation_appeals WHERE id = $1`,
        [appealId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * AUDIT / USAGE
     * ====================================================================== */

    async insertAuditEvent(client, data) {
      await client.query(
        `
        INSERT INTO community_audit_events (
          actor_id, action, resource_type, resource_id, before, after, outcome
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          data.actorId || null,
          data.action,
          data.resourceType,
          data.resourceId,
          data.before ? JSON.stringify(data.before) : null,
          data.after ? JSON.stringify(data.after) : null,
          data.outcome || 'success',
        ]
      );
    },

    async listAuditEvents({ limit = 50, cursor = null, resourceType = null, resourceId = null } = {}) {
      const params = [limit + 1];
      const conditions = [];
      if (resourceType) {
        params.push(resourceType);
        conditions.push(`resource_type = $${params.length}`);
      }
      if (resourceId) {
        params.push(resourceId);
        conditions.push(`resource_id = $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`occurred_at < $${params.length}`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await db.query(
        `
        SELECT * FROM community_audit_events
        ${where}
        ORDER BY occurred_at DESC
        LIMIT $1
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.occurred_at.toISOString() : null,
      };
    },
  };
}

export default createCommunityQueries;