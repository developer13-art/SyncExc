/**
 * SyncExc Server — Notification queries
 */

export function createNotificationQueries({ db }) {
  return {
    /* =========================================================================
     * EVENT TYPES
     * ====================================================================== */

    async upsertEventType(client, data) {
      const result = await client.query(
        `
        INSERT INTO notification_event_types (
          event_type, category, default_priority, default_channels, description
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (event_type) DO UPDATE SET
          category = EXCLUDED.category,
          default_priority = EXCLUDED.default_priority,
          default_channels = EXCLUDED.default_channels,
          description = EXCLUDED.description
        RETURNING *
        `,
        [
          data.eventType,
          data.category,
          data.defaultPriority,
          data.defaultChannels,
          data.description || null,
        ]
      );
      return result.rows[0];
    },

    async listEventTypes() {
      const result = await db.query(
        `SELECT * FROM notification_event_types ORDER BY category, event_type`
      );
      return result.rows;
    },

    async findEventType(eventType) {
      const result = await db.query(
        `SELECT * FROM notification_event_types WHERE event_type = $1`,
        [eventType]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * NOTIFICATION EVENTS
     * ====================================================================== */

    async insertNotificationEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO notification_events (
          event_type, schema_version, payload, actor_id, workspace_id,
          resource_type, resource_id, correlation_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          data.eventType,
          data.schemaVersion || 'v1',
          JSON.stringify(data.payload),
          data.actorId || null,
          data.workspaceId || null,
          data.resourceType || null,
          data.resourceId || null,
          data.correlationId || null,
        ]
      );
      return result.rows[0];
    },

    async findNotificationEventById(id) {
      const result = await db.query(
        `SELECT * FROM notification_events WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * NOTIFICATIONS
     * ====================================================================== */

    async insertNotification(client, data) {
      const result = await client.query(
        `
        INSERT INTO notifications (
          user_id, event_id, event_type, category, priority,
          title, message, action, status, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'created', $9)
        RETURNING *
        `,
        [
          data.userId,
          data.eventId || null,
          data.eventType,
          data.category,
          data.priority,
          data.title,
          data.message,
          data.action ? JSON.stringify(data.action) : null,
          data.expiresAt || null,
        ]
      );
      return result.rows[0];
    },

    async findNotificationById(id) {
      const result = await db.query(
        `SELECT * FROM notifications WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async listNotificationsForUser(
      userId,
      { category, unreadOnly, readOnly, q, limit = 50, offset = 0, cursor = null } = {}
    ) {
      const params = [userId];
      const conditions = ['user_id = $1', 'archived_at IS NULL'];
      if (category) {
        params.push(category);
        conditions.push(`category = $${params.length}`);
      }
      if (unreadOnly) {
        conditions.push('read_at IS NULL');
      } else if (readOnly) {
        conditions.push('read_at IS NOT NULL');
      }
      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(title ILIKE $${params.length} OR message ILIKE $${params.length})`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`created_at < $${params.length}`);
      }
      const where = conditions.join(' AND ');
      const countResult = await db.query(
        `SELECT count(*)::int AS total FROM notifications WHERE ${where}`,
        params
      );
      const total = countResult.rows[0].total;
      params.push(limit + 1);
      const limitParameter = params.length;
      params.push(offset);
      const offsetParameter = params.length;
      const result = await db.query(
        `
        SELECT * FROM notifications
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${limitParameter} OFFSET $${offsetParameter}
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.created_at.toISOString() : null,
        total,
      };
    },

    async countUnread(userId) {
      const result = await db.query(
        `SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL AND archived_at IS NULL`,
        [userId]
      );
      return result.rows[0].count;
    },

    async markRead(notificationId, userId) {
      const result = await db.query(
        `
        UPDATE notifications
        SET read_at = COALESCE(read_at, now()), status = 'read'
        WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
        RETURNING *
        `,
        [notificationId, userId]
      );
      return result.rows[0] || null;
    },

    async markAllRead(userId, { category } = {}) {
      const params = [userId];
      let categoryClause = '';
      if (category) {
        params.push(category);
        categoryClause = `AND category = $${params.length}`;
      }
      const result = await db.query(
        `
        UPDATE notifications
        SET read_at = now(), status = 'read'
        WHERE user_id = $1 AND read_at IS NULL AND archived_at IS NULL ${categoryClause}
        RETURNING id
        `,
        params
      );
      return result.rowCount;
    },

    async archiveNotification(notificationId, userId) {
      const result = await db.query(
        `
        UPDATE notifications
        SET archived_at = now(), status = 'archived'
        WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
        RETURNING *
        `,
        [notificationId, userId]
      );
      return result.rows[0] || null;
    },

    async updateNotificationStatus(notificationId, status) {
      const result = await db.query(
        `UPDATE notifications SET status = $2 WHERE id = $1 RETURNING *`,
        [notificationId, status]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * RECIPIENTS
     * ====================================================================== */

    async insertRecipient(client, data) {
      const result = await client.query(
        `
        INSERT INTO notification_recipients (notification_id, user_id, resource_type, resource_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (notification_id, user_id) DO NOTHING
        RETURNING *
        `,
        [data.notificationId, data.userId, data.resourceType || null, data.resourceId || null]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * DELIVERIES
     * ====================================================================== */

    async insertDelivery(client, data) {
      const result = await client.query(
        `
        INSERT INTO notification_deliveries (notification_id, channel, state)
        VALUES ($1, $2, 'pending')
        ON CONFLICT DO NOTHING
        RETURNING *
        `,
        [data.notificationId, data.channel]
      );
      return result.rows[0] || null;
    },

    async findDeliveryById(deliveryId) {
      const result = await db.query(
        `SELECT * FROM notification_deliveries WHERE id = $1`,
        [deliveryId]
      );
      return result.rows[0] || null;
    },

    async updateDelivery(deliveryId, fields) {
      const result = await db.query(
        `
        UPDATE notification_deliveries
        SET state = COALESCE($2, state),
            attempt_count = COALESCE($3, attempt_count),
            provider_ref = COALESCE($4, provider_ref),
            delivered_at = COALESCE($5, delivered_at),
            failure_reason = COALESCE($6, failure_reason),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          deliveryId,
          fields.state ?? null,
          fields.attemptCount ?? null,
          fields.providerRef ?? null,
          fields.deliveredAt ?? null,
          fields.failureReason ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async listDeliveriesForNotification(notificationId) {
      const result = await db.query(
        `SELECT * FROM notification_deliveries WHERE notification_id = $1`,
        [notificationId]
      );
      return result.rows;
    },

    async insertDeliveryAttempt(client, data) {
      const result = await client.query(
        `
        INSERT INTO notification_delivery_attempts (
          delivery_id, attempt_number, state, provider_ref, error_message, completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.deliveryId,
          data.attemptNumber,
          data.state,
          data.providerRef || null,
          data.errorMessage || null,
          data.completedAt || new Date(),
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * PREFERENCES
     * ====================================================================== */

    async getPreference(userId, notificationType, channel) {
      const result = await db.query(
        `
        SELECT * FROM notification_preferences
        WHERE user_id = $1 AND notification_type = $2 AND channel = $3
        `,
        [userId, notificationType, channel]
      );
      return result.rows[0] || null;
    },

    async listPreferences(userId) {
      const result = await db.query(
        `SELECT * FROM notification_preferences WHERE user_id = $1`,
        [userId]
      );
      return result.rows;
    },

    async upsertPreference(client, data) {
      const result = await client.query(
        `
        INSERT INTO notification_preferences (user_id, notification_type, channel, enabled)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, notification_type, channel)
        DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
        RETURNING *
        `,
        [data.userId, data.notificationType, data.channel, data.enabled]
      );
      return result.rows[0];
    },

    async getQuietHours(userId) {
      const result = await db.query(
        `SELECT * FROM notification_quiet_hours WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0] || null;
    },

    async upsertQuietHours(client, data) {
      const result = await client.query(
        `
        INSERT INTO notification_quiet_hours (
          user_id, enabled, start_time, end_time, timezone, days_of_week
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET
          enabled = EXCLUDED.enabled,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          timezone = EXCLUDED.timezone,
          days_of_week = EXCLUDED.days_of_week,
          updated_at = now()
        RETURNING *
        `,
        [
          data.userId,
          data.enabled,
          data.startTime || null,
          data.endTime || null,
          data.timezone || 'UTC',
          data.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
        ]
      );
      return result.rows[0];
    },

    async getWorkspacePolicy(workspaceId, category, channel) {
      const result = await db.query(
        `
        SELECT * FROM notification_workspace_policies
        WHERE workspace_id = $1 AND category = $2 AND channel = $3
        `,
        [workspaceId, category, channel]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * DEVICES
     * ====================================================================== */

    async insertPushSubscription(client, data) {
      const result = await client.query(
        `
        INSERT INTO notification_push_subscriptions (
          user_id, endpoint, p256dh, auth, device_label
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (endpoint) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth,
          device_label = EXCLUDED.device_label,
          status = 'active'
        RETURNING *
        `,
        [data.userId, data.endpoint, data.p256dh, data.auth, data.deviceLabel || null]
      );
      return result.rows[0];
    },

    async listPushSubscriptions(userId) {
      const result = await db.query(
        `
        SELECT * FROM notification_push_subscriptions
        WHERE user_id = $1 AND status = 'active'
        `,
        [userId]
      );
      return result.rows;
    },

    async updatePushSubscription(subscriptionId, fields) {
      const result = await db.query(
        `
        UPDATE notification_push_subscriptions
        SET status = COALESCE($2, status),
            last_used_at = COALESCE($3, last_used_at)
        WHERE id = $1
        RETURNING *
        `,
        [subscriptionId, fields.status ?? null, fields.lastUsedAt ?? null]
      );
      return result.rows[0] || null;
    },

    async deletePushSubscription(subscriptionId, userId) {
      const result = await db.query(
        `DELETE FROM notification_push_subscriptions WHERE id = $1 AND user_id = $2 RETURNING id`,
        [subscriptionId, userId]
      );
      return result.rowCount > 0;
    },

    async listEmailDestinations(userId) {
      const result = await db.query(
        `SELECT * FROM notification_email_destinations WHERE user_id = $1`,
        [userId]
      );
      return result.rows;
    },

    /* =========================================================================
     * TEMPLATES
     * ====================================================================== */

    async findTemplate(key) {
      const result = await db.query(
        `SELECT * FROM notification_templates WHERE key = $1`,
        [key]
      );
      return result.rows[0] || null;
    },

    async findTemplateVersion(templateId, version, locale = 'en') {
      const result = await db.query(
        `
        SELECT * FROM notification_template_versions
        WHERE template_id = $1 AND version = $2 AND locale = $3
        `,
        [templateId, version, locale]
      );
      return result.rows[0] || null;
    },

    async findLatestTemplateVersion(templateId, locale = 'en') {
      const result = await db.query(
        `
        SELECT * FROM notification_template_versions
        WHERE template_id = $1 AND locale = $2
        ORDER BY version DESC
        LIMIT 1
        `,
        [templateId, locale]
      );
      return result.rows[0] || null;
    },

    async listTemplates() {
      const result = await db.query(
        `SELECT * FROM notification_templates ORDER BY key`
      );
      return result.rows;
    },

    async insertTemplate(client, data) {
      const result = await client.query(
        `
        INSERT INTO notification_templates (key, event_type, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO NOTHING
        RETURNING *
        `,
        [data.key, data.eventType, data.description || null]
      );
      return result.rows[0] || null;
    },

    async insertTemplateVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO notification_template_versions (
          template_id, version, locale, title_template, body_template, action_template, channels
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (template_id, version, locale) DO NOTHING
        RETURNING *
        `,
        [
          data.templateId,
          data.version,
          data.locale || 'en',
          data.titleTemplate,
          data.bodyTemplate,
          data.actionTemplate ? JSON.stringify(data.actionTemplate) : null,
          data.channels || ['in_app', 'email'],
        ]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * DEDUPLICATION
     * ====================================================================== */

    async findDedupKey(key) {
      const result = await db.query(
        `SELECT * FROM notification_deduplication_keys WHERE key = $1`,
        [key]
      );
      return result.rows[0] || null;
    },

    async insertDedupKey(client, data) {
      const result = await client.query(
        `
        INSERT INTO notification_deduplication_keys (key, notification_id)
        VALUES ($1, $2)
        ON CONFLICT (key) DO NOTHING
        RETURNING *
        `,
        [data.key, data.notificationId || null]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * GROUPS
     * ====================================================================== */

    async findGroup(groupKey) {
      const result = await db.query(
        `SELECT * FROM notification_groups WHERE group_key = $1`,
        [groupKey]
      );
      return result.rows[0] || null;
    },

    async upsertGroup(client, data) {
      const result = await client.query(
        `
        INSERT INTO notification_groups (group_key, category, priority, state, first_event_at, latest_event_at)
        VALUES ($1, $2, $3, 'open', now(), now())
        ON CONFLICT (group_key) DO UPDATE SET
          latest_event_at = now(),
          state = CASE WHEN EXCLUDED.state = 'resolved' THEN 'resolved' ELSE notification_groups.state END
        RETURNING *
        `,
        [data.groupKey, data.category, data.priority, data.state || 'open']
      );
      return result.rows[0];
    },

    async resolveGroup(groupKey) {
      await db.query(
        `UPDATE notification_groups SET state = 'resolved', resolved_at = now() WHERE group_key = $1`,
        [groupKey]
      );
    },

    /* =========================================================================
     * ESCALATION
     * ====================================================================== */

    async findEscalationPolicy(category, priority) {
      const result = await db.query(
        `
        SELECT * FROM notification_escalation_policies
        WHERE category = $1 AND priority = $2
        LIMIT 1
        `,
        [category, priority]
      );
      return result.rows[0] || null;
    },

    async insertEscalationEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO notification_escalation_events (notification_id, policy_id, outcome, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          data.notificationId || null,
          data.policyId || null,
          data.outcome,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * PROVIDER REGISTRY
     * ====================================================================== */

    async findProvider(providerKey) {
      const result = await db.query(
        `SELECT * FROM notification_provider_registry WHERE provider_key = $1`,
        [providerKey]
      );
      return result.rows[0] || null;
    },

    async insertProviderEvent(client, data) {
      await client.query(
        `
        INSERT INTO notification_provider_events (provider_key, event_type, payload)
        VALUES ($1, $2, $3)
        `,
        [data.providerKey, data.eventType, JSON.stringify(data.payload)]
      );
    },

    /* =========================================================================
     * USAGE
     * ====================================================================== */

    async insertUsageEvent(client, data) {
      await client.query(
        `
        INSERT INTO notification_usage_events (user_id, workspace_id, channel, amount)
        VALUES ($1, $2, $3, $4)
        `,
        [data.userId || null, data.workspaceId || null, data.channel, data.amount || 1]
      );
    },
  };
}

export default createNotificationQueries;