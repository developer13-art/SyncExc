/**
 * SyncExc Server — Email module queries
 *
 * Delivery records, webhook dedup, and admin monitoring reads.
 */

export function createEmailQueries({ db }) {
  async function updateDelivery(client, deliveryId, fields) {
    const sets = [];
    const params = [deliveryId];
    const push = (column, value) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };

    if (fields.requestStatus !== undefined) push('request_status', fields.requestStatus);
    if (fields.deliveryStatus !== undefined) push('delivery_status', fields.deliveryStatus);
    if (fields.providerMessageId !== undefined) push('provider_message_id', fields.providerMessageId);
    if (fields.failureReason !== undefined) push('failure_reason', fields.failureReason);
    if (fields.errorCategory !== undefined) push('error_category', fields.errorCategory);

    if (!sets.length) return null;
    sets.push('updated_at = now()');

    const result = await client.query(
      `UPDATE email_deliveries SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0];
  }

  return {
    updateDelivery,

    async insertDelivery(client, data) {
      const result = await client.query(
        `
        INSERT INTO email_deliveries (
          user_id, recipient_email, email_type, subject, provider,
          request_status, delivery_status, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          data.userId || null,
          data.recipientEmail,
          data.emailType,
          data.subject || null,
          data.provider,
          data.requestStatus || 'pending',
          data.deliveryStatus || 'unknown',
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    async updateDeliveryByMessageId(client, providerMessageId, fields) {
      const result = await db.query(
        `
        SELECT id FROM email_deliveries
        WHERE provider_message_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [providerMessageId]
      );
      if (!result.rows[0]) return null;
      return updateDelivery(client, result.rows[0].id, fields);
    },

    async insertWebhookEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO email_webhook_events (
          provider_event_id, provider, event_type, provider_message_id, payload
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (provider_event_id) DO NOTHING
        RETURNING *
        `,
        [
          data.providerEventId,
          data.provider,
          data.eventType,
          data.providerMessageId || null,
          JSON.stringify(data.payload),
        ]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * ADMIN MONITORING
     * ====================================================================== */

    async listDeliveries({ filters = {}, limit = 50, offset = 0 } = {}) {
      const where = [];
      const params = [];
      const add = (condition, value) => {
        params.push(value);
        where.push(condition.replace('?', `$${params.length}`));
      };

      if (filters.emailType) add('email_type = ?', filters.emailType);
      if (filters.requestStatus) add('request_status = ?', filters.requestStatus);
      if (filters.deliveryStatus) add('delivery_status = ?', filters.deliveryStatus);
      if (filters.provider) add('provider = ?', filters.provider);
      if (filters.errorCategory) add('error_category = ?', filters.errorCategory);
      if (filters.recipient) add('recipient_email ILIKE ?', `%${filters.recipient}%`);
      if (filters.userId) add('user_id = ?', filters.userId);
      if (filters.dateFrom) add('created_at >= ?', filters.dateFrom);
      if (filters.dateTo) add('created_at <= ?', filters.dateTo);

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      params.push(limit, offset);

      const result = await db.query(
        `
        SELECT * FROM email_deliveries
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );
      return result.rows;
    },

    async countDeliveries({ filters = {} } = {}) {
      const where = [];
      const params = [];
      const add = (condition, value) => {
        params.push(value);
        where.push(condition.replace('?', `$${params.length}`));
      };

      if (filters.emailType) add('email_type = ?', filters.emailType);
      if (filters.requestStatus) add('request_status = ?', filters.requestStatus);
      if (filters.deliveryStatus) add('delivery_status = ?', filters.deliveryStatus);
      if (filters.provider) add('provider = ?', filters.provider);
      if (filters.errorCategory) add('error_category = ?', filters.errorCategory);
      if (filters.recipient) add('recipient_email ILIKE ?', `%${filters.recipient}%`);
      if (filters.userId) add('user_id = ?', filters.userId);
      if (filters.dateFrom) add('created_at >= ?', filters.dateFrom);
      if (filters.dateTo) add('created_at <= ?', filters.dateTo);

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const result = await db.query(
        `SELECT count(*)::int AS count FROM email_deliveries ${whereSql}`,
        params
      );
      return result.rows[0]?.count || 0;
    },

    async deliveryStats({ hours = 24 } = {}) {
      const result = await db.query(
        `
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE request_status = 'accepted')::int AS accepted,
          count(*) FILTER (WHERE request_status = 'failed')::int AS failed,
          count(*) FILTER (WHERE delivery_status = 'delivered')::int AS delivered,
          count(*) FILTER (WHERE delivery_status = 'bounced')::int AS bounced,
          count(*) FILTER (WHERE delivery_status = 'complained')::int AS complained,
          count(*) FILTER (WHERE delivery_status = 'failed')::int AS delivery_failed,
          count(*) FILTER (WHERE delivery_status = 'suppressed')::int AS suppressed,
          count(*) FILTER (WHERE request_status = 'pending')::int AS pending
        FROM email_deliveries
        WHERE created_at >= now() - ($1 || ' hours')::interval
        `,
        [String(hours)]
      );
      return result.rows[0];
    },

    async recentFailures({ limit = 20 } = {}) {
      const result = await db.query(
        `
        SELECT id, recipient_email, email_type, subject, provider, request_status,
               delivery_status, failure_reason, error_category, created_at
        FROM email_deliveries
        WHERE request_status = 'failed' OR delivery_status IN ('failed', 'bounced')
        ORDER BY created_at DESC
        LIMIT $1
        `,
        [limit]
      );
      return result.rows;
    },

    async recentWebhookEvents({ limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT provider_event_id, provider, event_type, provider_message_id, processed_at
        FROM email_webhook_events
        ORDER BY processed_at DESC
        LIMIT $1
        `,
        [limit]
      );
      return result.rows;
    },

    async findUserByEmail(email) {
      const result = await db.query(
        `SELECT id FROM users WHERE email_normalized = $1 AND deleted_at IS NULL LIMIT 1`,
        [String(email).trim().toLowerCase()]
      );
      return result.rows[0] || null;
    },
  };
}
