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
        INSERT INTO community_profiles (user_id, handle, display_name, biography, long_introduction, visibility)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.userId,
          data.handle,
          data.displayName,
          data.biography || null,
          data.longIntroduction || null,
          data.visibility || 'public',
        ]
      );
      return result.rows[0];
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

    async updateProfile(profileId, fields) {
      const result = await db.query(
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
        `SELECT * FROM community_posts WHERE id = $1 AND deleted_at IS NULL`,
        [postId]
      );
      return result.rows[0] || null;
    },

    async updatePost(postId, fields) {
      const result = await db.query(
        `
        UPDATE community_posts
        SET content = COALESCE($2, content),
            topics = COALESCE($3, topics),
            allow_comments = COALESCE($4, allow_comments),
            engagement = COALESCE($5, engagement),
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
        ]
      );
      return result.rows[0] || null;
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
      const conditions = ['p.deleted_at IS NULL', "p.visibility = 'public'"];

      if (followingOnly) {
        params.push(userId);
        conditions.push(
          `(p.author_id = $${params.length} OR p.author_id IN (SELECT followee_id FROM community_follows WHERE follower_id = $${params.length}))`
        );
      }

      if (cursor) {
        params.push(cursor);
        conditions.push(`p.created_at < $${params.length}`);
      }

      const result = await db.query(
        `
        SELECT p.*, prof.handle AS author_handle, prof.display_name AS author_name, prof.avatar_url AS author_avatar
        FROM community_posts p
        JOIN community_profiles prof ON prof.user_id = p.author_id
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

      if (viewerId !== authorId) {
        // Apply visibility filtering
        params.push(viewerId);
        conditions.push(`(
          p.visibility = 'public'
          OR (p.visibility = 'followers' AND EXISTS (SELECT 1 FROM community_follows WHERE follower_id = $${params.length} AND followee_id = $1))
          OR (p.visibility = 'workspace_members' AND p.destination_type = 'workspace_discussion')
        )`);
      }

      if (cursor) {
        params.push(cursor);
        conditions.push(`p.created_at < $${params.length}`);
      }

      const result = await db.query(
        `
        SELECT p.*, prof.handle AS author_handle, prof.display_name AS author_name, prof.avatar_url AS author_avatar
        FROM community_posts p
        JOIN community_profiles prof ON prof.user_id = p.author_id
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
        SELECT c.*, prof.handle AS author_handle, prof.display_name AS author_name, prof.avatar_url AS author_avatar
        FROM community_comments c
        JOIN community_profiles prof ON prof.user_id = c.author_id
        WHERE c.post_id = $1 AND c.deleted_at IS NULL
        ORDER BY c.created_at ASC
        LIMIT $2
        `,
        [postId, limit]
      );
      return result.rows;
    },

    async softDeleteComment(commentId) {
      const result = await db.query(
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

    async listPublicGroups({ limit = 50, cursor = null } = {}) {
      const params = [limit + 1];
      const conditions = ["type = 'public'"];
      if (cursor) {
        params.push(cursor);
        conditions.push(`created_at < $${params.length}`);
      }
      const result = await db.query(
        `
        SELECT * FROM community_groups
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
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

    async incrementGroupMemberCount(groupId, delta) {
      await db.query(
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

    async listGroupMembers(groupId, { limit = 100 } = {}) {
      const result = await db.query(
        `
        SELECT m.*, p.handle, p.display_name, p.avatar_url
        FROM community_group_memberships m
        JOIN community_profiles p ON p.user_id = m.user_id
        WHERE m.group_id = $1 AND m.state = 'active'
        ORDER BY m.created_at ASC
        LIMIT $2
        `,
        [groupId, limit]
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

    async listDiscussionThreads(channelId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT t.*, p.handle AS creator_handle, p.display_name AS creator_name
        FROM community_discussion_threads t
        JOIN community_profiles p ON p.user_id = t.created_by
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
        SELECT m.*, p.handle AS author_handle, p.display_name AS author_name
        FROM community_discussion_messages m
        JOIN community_profiles p ON p.user_id = m.author_id
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
        `SELECT * FROM community_analysis_documents WHERE id = $1`,
        [documentId]
      );
      return result.rows[0] || null;
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
        SELECT p.*, prof.handle AS author_handle, prof.display_name AS author_name
        FROM community_posts p
        JOIN community_profiles prof ON prof.user_id = p.author_id
        WHERE p.deleted_at IS NULL
          AND p.visibility = 'public'
          AND to_tsvector('english', p.content) @@ plainto_tsquery('english', $1)
        ORDER BY p.created_at DESC
        LIMIT $2
        `,
        [query, limit]
      );
      return result.rows;
    },

    async searchProfiles({ query, limit = 50 }) {
      const result = await db.query(
        `
        SELECT p.* FROM community_profiles p
        WHERE p.visibility = 'public'
          AND (
            p.display_name ILIKE $1 OR
            p.handle ILIKE $1 OR
            p.biography ILIKE $1
          )
        ORDER BY p.created_at DESC
        LIMIT $2
        `,
        [`%${query}%`, limit]
      );
      return result.rows;
    },

    async searchGroups({ query, limit = 50 }) {
      const result = await db.query(
        `
        SELECT * FROM community_groups
        WHERE type = 'public'
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

    async updateModerationCase(caseId, fields) {
      const result = await db.query(
        `
        UPDATE community_moderation_cases
        SET state = COALESCE($2, state),
            assigned_to = COALESCE($3, assigned_to),
            resolved_at = COALESCE($4, resolved_at)
        WHERE id = $1
        RETURNING *
        `,
        [caseId, fields.state ?? null, fields.assignedTo ?? null, fields.resolvedAt ?? null]
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
  };
}

export default createCommunityQueries;