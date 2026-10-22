export function createMessagingQueries({ db }) {
  return {
    async findConversationByPair(participantLow, participantHigh, client = db) {
      const result = await client.query(
        `
        SELECT * FROM community_conversations
        WHERE participant_low = $1 AND participant_high = $2
        `,
        [participantLow, participantHigh]
      );
      return result.rows[0] || null;
    },

    async findConversationForUser(conversationId, userId, client = db) {
      const result = await client.query(
        `
        SELECT * FROM community_conversations
        WHERE id = $1 AND (participant_low = $2 OR participant_high = $2)
        `,
        [conversationId, userId]
      );
      return result.rows[0] || null;
    },

    async insertConversation(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_conversations (
          participant_low, participant_high, created_by, state
        )
        VALUES ($1, $2, $3, 'pending')
        ON CONFLICT (participant_low, participant_high) DO NOTHING
        RETURNING *
        `,
        [data.participantLow, data.participantHigh, data.createdBy]
      );
      return result.rows[0] || null;
    },

    async listConversations(userId, { limit = 50, cursor = null } = {}) {
      const params = [userId, limit + 1];
      let cursorClause = '';
      if (cursor) {
        params.push(cursor);
        cursorClause = `AND c.last_message_at < $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT c.*,
               CASE WHEN c.participant_low = $1 THEN c.participant_high ELSE c.participant_low END AS other_user_id,
               COALESCE(p.handle, u.username_normalized, u.username) AS other_handle,
               COALESCE(p.display_name, u.display_name) AS other_display_name,
               COALESCE(p.avatar_url, u.avatar_url) AS other_avatar_url,
               m.content AS last_message,
               CASE WHEN c.participant_low = $1
                 THEN c.participant_low_read_at
                 ELSE c.participant_high_read_at
               END AS viewer_read_at
        FROM community_conversations c
        JOIN users u
          ON u.id = CASE WHEN c.participant_low = $1 THEN c.participant_high ELSE c.participant_low END
        LEFT JOIN community_profiles p ON p.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT content FROM community_messages
          WHERE conversation_id = c.id AND deleted_at IS NULL
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        ) m ON true
        WHERE (c.participant_low = $1 OR c.participant_high = $1)
          AND c.state = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM community_blocks b
            WHERE (b.blocker_id = $1 AND b.blocked_id =
              CASE WHEN c.participant_low = $1 THEN c.participant_high ELSE c.participant_low END)
               OR (b.blocked_id = $1 AND b.blocker_id =
              CASE WHEN c.participant_low = $1 THEN c.participant_high ELSE c.participant_low END)
          )
          ${cursorClause}
        ORDER BY c.last_message_at DESC, c.id DESC
        LIMIT $2
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.last_message_at.toISOString() : null,
      };
    },

    async listRequests(userId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT c.*,
               CASE WHEN c.participant_low = $1 THEN c.participant_high ELSE c.participant_low END AS other_user_id,
               COALESCE(p.handle, u.username_normalized, u.username) AS other_handle,
               COALESCE(p.display_name, u.display_name) AS other_display_name,
               COALESCE(p.avatar_url, u.avatar_url) AS other_avatar_url,
               m.content AS initial_message
        FROM community_conversations c
        JOIN users u
          ON u.id = CASE WHEN c.participant_low = $1 THEN c.participant_high ELSE c.participant_low END
        LEFT JOIN community_profiles p ON p.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT content FROM community_messages
          WHERE conversation_id = c.id AND deleted_at IS NULL
          ORDER BY created_at ASC, id ASC
          LIMIT 1
        ) m ON true
        WHERE (c.participant_low = $1 OR c.participant_high = $1)
          AND c.state = 'pending'
          AND c.created_by <> $1
          AND NOT EXISTS (
            SELECT 1 FROM community_blocks b
            WHERE (b.blocker_id = $1 AND b.blocked_id =
              CASE WHEN c.participant_low = $1 THEN c.participant_high ELSE c.participant_low END)
               OR (b.blocked_id = $1 AND b.blocker_id =
              CASE WHEN c.participant_low = $1 THEN c.participant_high ELSE c.participant_low END)
          )
        ORDER BY c.last_message_at DESC, c.id DESC
        LIMIT $2
        `,
        [userId, limit]
      );
      return result.rows;
    },

    async listMessages(conversationId, { limit = 50, cursor = null } = {}) {
      const params = [conversationId, limit + 1];
      let cursorClause = '';
      if (cursor) {
        params.push(cursor);
        cursorClause = `AND created_at < $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT id, conversation_id, sender_id, content, created_at, edited_at
        FROM community_messages
        WHERE conversation_id = $1 AND deleted_at IS NULL
          ${cursorClause}
        ORDER BY created_at DESC, id DESC
        LIMIT $2
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows: rows.reverse(),
        nextCursor: hasMore && last ? last.created_at.toISOString() : null,
      };
    },

    async findMessageById(messageId) {
      const result = await db.query(
        `SELECT id, conversation_id FROM community_messages
         WHERE id = $1 AND deleted_at IS NULL`,
        [messageId]
      );
      return result.rows[0] || null;
    },

    async insertMessage(client, data) {
      const result = await client.query(
        `
        INSERT INTO community_messages (conversation_id, sender_id, content)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.conversationId, data.senderId, data.content]
      );
      return result.rows[0];
    },

    async touchConversation(client, conversationId, userId, timestamp) {
      await client.query(
        `
        UPDATE community_conversations
        SET last_message_at = $3,
            participant_low_read_at = CASE WHEN participant_low = $2 THEN $3 ELSE participant_low_read_at END,
            participant_high_read_at = CASE WHEN participant_high = $2 THEN $3 ELSE participant_high_read_at END,
            updated_at = now()
        WHERE id = $1
        `,
        [conversationId, userId, timestamp]
      );
    },

    async setConversationState(client, conversationId, state, expectedState = 'pending') {
      const result = await client.query(
        `
        UPDATE community_conversations
        SET state = $2, updated_at = now()
        WHERE id = $1 AND state = $3
        RETURNING *
        `,
        [conversationId, state, expectedState]
      );
      return result.rows[0] || null;
    },

    async markRead(conversationId, userId) {
      await db.query(
        `
        UPDATE community_conversations
        SET participant_low_read_at = CASE WHEN participant_low = $2 THEN now() ELSE participant_low_read_at END,
            participant_high_read_at = CASE WHEN participant_high = $2 THEN now() ELSE participant_high_read_at END
        WHERE id = $1 AND (participant_low = $2 OR participant_high = $2)
        `,
        [conversationId, userId]
      );
    },
  };
}

export default createMessagingQueries;
