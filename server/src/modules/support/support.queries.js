/**
 * SyncExc Server — Support queries
 */

export function createSupportQueries({ db }) {
  return {
    /* =========================================================================
     * CATEGORIES
     * ====================================================================== */

    async listCategories() {
      const result = await db.query(
        `SELECT * FROM support_ticket_categories ORDER BY label ASC`
      );
      return result.rows;
    },

    /* =========================================================================
     * TICKETS
     * ====================================================================== */

    async insertTicket(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_tickets (
          reference, requester_id, workspace_id, subject, category, issue_type,
          description, impact, priority, status, affected_resource,
          occurrence_time, preferred_language
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', $10, $11, $12)
        RETURNING *
        `,
        [
          data.reference,
          data.requesterId,
          data.workspaceId || null,
          data.subject,
          data.category,
          data.issueType || null,
          data.description,
          data.impact || null,
          data.priority || 'normal',
          data.affectedResource ? JSON.stringify(data.affectedResource) : null,
          data.occurrenceTime || null,
          data.preferredLanguage || 'en',
        ]
      );
      return result.rows[0];
    },

    async findTicketById(ticketId) {
      const result = await db.query(
        `SELECT * FROM support_tickets WHERE id = $1`,
        [ticketId]
      );
      return result.rows[0] || null;
    },

    async findTicketByReference(reference) {
      const result = await db.query(
        `SELECT * FROM support_tickets WHERE reference = $1`,
        [reference]
      );
      return result.rows[0] || null;
    },

    async listTicketsForRequester(requesterId, { status, limit = 50, cursor = null } = {}) {
      const params = [requesterId, limit + 1];
      const conditions = ['requester_id = $1'];
      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`created_at < $${params.length}`);
      }
      const result = await db.query(
        `
        SELECT * FROM support_tickets
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
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

    async listTicketsForQueues({ queueIds, status, priority, limit = 50, cursor = null } = {}) {
      const params = [limit + 1];
      const conditions = [];

      if (queueIds && queueIds.length > 0) {
        params.push(queueIds);
        conditions.push(`queue_id = ANY($${params.length}::uuid[])`);
      }
      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }
      if (priority) {
        params.push(priority);
        conditions.push(`priority = $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`created_at < $${params.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await db.query(
        `
        SELECT * FROM support_tickets
        ${where}
        ORDER BY
          CASE priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END ASC,
          created_at ASC
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

    async updateTicket(ticketId, fields) {
      const result = await db.query(
        `
        UPDATE support_tickets
        SET subject = COALESCE($2, subject),
            category = COALESCE($3, category),
            issue_type = COALESCE($4, issue_type),
            impact = COALESCE($5, impact),
            priority = COALESCE($6, priority),
            status = COALESCE($7, status),
            assigned_to_id = COALESCE($8, assigned_to_id),
            queue_id = COALESCE($9, queue_id),
            first_response_at = COALESCE($10, first_response_at),
            resolved_at = COALESCE($11, resolved_at),
            closed_at = COALESCE($12, closed_at),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          ticketId,
          fields.subject ?? null,
          fields.category ?? null,
          fields.issueType ?? null,
          fields.impact ?? null,
          fields.priority ?? null,
          fields.status ?? null,
          fields.assignedToId ?? null,
          fields.queueId ?? null,
          fields.firstResponseAt ?? null,
          fields.resolvedAt ?? null,
          fields.closedAt ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertStatusHistory(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_ticket_status_history (
          ticket_id, previous_status, new_status, actor_id, reason
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.ticketId,
          data.previousStatus || null,
          data.newStatus,
          data.actorId || null,
          data.reason || null,
        ]
      );
      return result.rows[0];
    },

    async listStatusHistory(ticketId) {
      const result = await db.query(
        `
        SELECT h.*, u.email AS actor_email
        FROM support_ticket_status_history h
        LEFT JOIN users u ON u.id = h.actor_id
        WHERE h.ticket_id = $1
        ORDER BY h.created_at ASC
        `,
        [ticketId]
      );
      return result.rows;
    },

    /* =========================================================================
     * MESSAGES
     * ====================================================================== */

    async insertMessage(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_ticket_messages (ticket_id, author_id, content)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.ticketId, data.authorId, data.content]
      );
      return result.rows[0];
    },

    async listMessages(ticketId) {
      const result = await db.query(
        `
        SELECT m.*, u.email AS author_email, u.display_name AS author_display_name
        FROM support_ticket_messages m
        JOIN users u ON u.id = m.author_id
        WHERE m.ticket_id = $1
        ORDER BY m.created_at ASC
        `,
        [ticketId]
      );
      return result.rows;
    },

    async insertInternalNote(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_ticket_internal_notes (ticket_id, author_id, content, mentions)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.ticketId, data.authorId, data.content, data.mentions || []]
      );
      return result.rows[0];
    },

    async listInternalNotes(ticketId) {
      const result = await db.query(
        `
        SELECT n.*, u.email AS author_email, u.display_name AS author_display_name
        FROM support_ticket_internal_notes n
        JOIN users u ON u.id = n.author_id
        WHERE n.ticket_id = $1
        ORDER BY n.created_at ASC
        `,
        [ticketId]
      );
      return result.rows;
    },

    /* =========================================================================
     * ATTACHMENTS
     * ====================================================================== */

    async insertAttachment(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_ticket_attachments (
          ticket_id, message_id, uploader_id, storage_key, file_name,
          mime_type, size_bytes, content_hash, scan_state
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          data.ticketId,
          data.messageId || null,
          data.uploaderId,
          data.storageKey,
          data.fileName,
          data.mimeType,
          data.sizeBytes,
          data.contentHash || null,
          data.scanState || 'pending',
        ]
      );
      return result.rows[0];
    },

    async findAttachmentById(attachmentId) {
      const result = await db.query(
        `SELECT * FROM support_ticket_attachments WHERE id = $1`,
        [attachmentId]
      );
      return result.rows[0] || null;
    },

    async listAttachments(ticketId) {
      const result = await db.query(
        `
        SELECT * FROM support_ticket_attachments
        WHERE ticket_id = $1
        ORDER BY created_at ASC
        `,
        [ticketId]
      );
      return result.rows;
    },

    async updateAttachmentScanState(attachmentId, scanState, scanResult) {
      const result = await db.query(
        `
        UPDATE support_ticket_attachments
        SET scan_state = $2, scan_result = $3
        WHERE id = $1
        RETURNING *
        `,
        [attachmentId, scanState, scanResult ? JSON.stringify(scanResult) : null]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * QUEUES
     * ====================================================================== */

    async listQueues() {
      const result = await db.query(
        `SELECT * FROM support_queues ORDER BY name ASC`
      );
      return result.rows;
    },

    async findQueueById(queueId) {
      const result = await db.query(
        `SELECT * FROM support_queues WHERE id = $1`,
        [queueId]
      );
      return result.rows[0] || null;
    },

    async listQueueMembers(queueId) {
      const result = await db.query(
        `
        SELECT m.*, u.email AS user_email
        FROM support_queue_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.queue_id = $1
        `,
        [queueId]
      );
      return result.rows;
    },

    async insertQueueMember(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_queue_members (queue_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (queue_id, user_id) DO UPDATE SET role = EXCLUDED.role
        RETURNING *
        `,
        [data.queueId, data.userId, data.role || 'agent']
      );
      return result.rows[0];
    },

    /* =========================================================================
     * ASSIGNMENTS
     * ====================================================================== */

    async insertAssignment(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_ticket_assignments (ticket_id, assigned_to_id, queue_id, assigned_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.ticketId, data.assignedToId || null, data.queueId || null, data.assignedBy || null]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * ESCALATIONS
     * ====================================================================== */

    async findEscalationPolicy(category, priority) {
      const result = await db.query(
        `
        SELECT * FROM support_escalation_policies
        WHERE category = $1 AND priority = $2
        LIMIT 1
        `,
        [category, priority]
      );
      return result.rows[0] || null;
    },

    async insertEscalation(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_escalation_events (
          ticket_id, policy_id, category, escalated_to, reason
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.ticketId,
          data.policyId || null,
          data.category,
          data.escalatedTo || null,
          data.reason,
        ]
      );
      return result.rows[0];
    },

    async resolveEscalation(escalationId) {
      const result = await db.query(
        `
        UPDATE support_escalation_events
        SET resolved_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [escalationId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * SLA
     * ====================================================================== */

    async findResponseTarget(priority) {
      const result = await db.query(
        `SELECT * FROM support_response_targets WHERE priority = $1`,
        [priority]
      );
      return result.rows[0] || null;
    },

    async insertTargetEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_target_events (
          ticket_id, target_type, event_type, breached
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          data.ticketId,
          data.targetType,
          data.eventType,
          data.breached || false,
        ]
      );
      return result.rows[0];
    },

    async listTargetEvents(ticketId) {
      const result = await db.query(
        `
        SELECT * FROM support_target_events
        WHERE ticket_id = $1
        ORDER BY occurred_at ASC
        `,
        [ticketId]
      );
      return result.rows;
    },

    /* =========================================================================
     * DIAGNOSTICS
     * ====================================================================== */

    async insertDiagnosticRun(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_diagnostic_runs (
          ticket_id, requested_by, diagnostic_type, scope, status, started_at
        )
        VALUES ($1, $2, $3, $4, 'running', now())
        RETURNING *
        `,
        [
          data.ticketId,
          data.requestedBy,
          data.diagnosticType,
          JSON.stringify(data.scope || {}),
        ]
      );
      return result.rows[0];
    },

    async updateDiagnosticRun(runId, fields) {
      const result = await db.query(
        `
        UPDATE support_diagnostic_runs
        SET status = COALESCE($2, status),
            completed_at = COALESCE($3, completed_at)
        WHERE id = $1
        RETURNING *
        `,
        [runId, fields.status ?? null, fields.completedAt ?? null]
      );
      return result.rows[0] || null;
    },

    async insertDiagnosticResult(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_diagnostic_results (run_id, result, sanitized)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.runId, JSON.stringify(data.result), data.sanitized ?? true]
      );
      return result.rows[0];
    },

    async listDiagnosticRuns(ticketId) {
      const result = await db.query(
        `
        SELECT r.*, u.email AS requested_by_email
        FROM support_diagnostic_runs r
        LEFT JOIN users u ON u.id = r.requested_by
        WHERE r.ticket_id = $1
        ORDER BY r.started_at DESC
        `,
        [ticketId]
      );
      return result.rows;
    },

    /* =========================================================================
     * HELP CENTER
     * ====================================================================== */

    async insertArticle(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_articles (slug, title, state, category_id, created_by)
        VALUES ($1, $2, 'draft', $3, $4)
        RETURNING *
        `,
        [data.slug, data.title, data.categoryId || null, data.createdBy]
      );
      return result.rows[0];
    },

    async findArticleById(articleId) {
      const result = await db.query(
        `SELECT * FROM support_articles WHERE id = $1`,
        [articleId]
      );
      return result.rows[0] || null;
    },

    async findArticleBySlug(slug) {
      const result = await db.query(
        `SELECT * FROM support_articles WHERE slug = $1 AND state = 'published'`,
        [slug]
      );
      return result.rows[0] || null;
    },

    async listPublishedArticles({ category, limit = 50 } = {}) {
      const params = [limit];
      let categoryClause = '';
      if (category) {
        params.push(category);
        categoryClause = `AND category_id = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM support_articles
        WHERE state = 'published' ${categoryClause}
        ORDER BY updated_at DESC
        LIMIT $1
        `,
        params
      );
      return result.rows;
    },

    async insertArticleVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_article_versions (article_id, version, content, summary)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (article_id, version) DO NOTHING
        RETURNING *
        `,
        [data.articleId, data.version, data.content, data.summary || null]
      );
      return result.rows[0] || null;
    },

    async findArticleVersion(articleId, version) {
      const result = await db.query(
        `
        SELECT * FROM support_article_versions
        WHERE article_id = $1 AND version = $2
        `,
        [articleId, version]
      );
      return result.rows[0] || null;
    },

    async updateArticle(articleId, fields) {
      const result = await db.query(
        `
        UPDATE support_articles
        SET title = COALESCE($2, title),
            state = COALESCE($3, state),
            current_version = COALESCE($4, current_version),
            published_at = COALESCE($5, published_at),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          articleId,
          fields.title ?? null,
          fields.state ?? null,
          fields.currentVersion ?? null,
          fields.publishedAt ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async listArticleCategories() {
      const result = await db.query(
        `SELECT * FROM support_article_categories ORDER BY name ASC`
      );
      return result.rows;
    },

    async searchArticles(query, { limit = 20 } = {}) {
      const result = await db.query(
        `
        SELECT a.*, v.content, v.summary
        FROM support_articles a
        JOIN support_article_versions v ON v.article_id = a.id AND v.version = a.current_version
        WHERE a.state = 'published'
          AND (
            to_tsvector('english', a.title || ' ' || COALESCE(v.content, '')) @@ plainto_tsquery('english', $1)
            OR a.title ILIKE $2
          )
        ORDER BY a.updated_at DESC
        LIMIT $3
        `,
        [query, `%${query}%`, limit]
      );
      return result.rows;
    },

    async insertArticleFeedback(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_article_feedback (article_id, user_id, helpful, comment)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.articleId, data.userId || null, data.helpful, data.comment || null]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * FEEDBACK
     * ====================================================================== */

    async insertFeedback(client, data) {
      const result = await client.query(
        `
        INSERT INTO support_feedback (ticket_id, user_id, score, comment, issue_resolved)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.ticketId,
          data.userId,
          data.score || null,
          data.comment || null,
          data.issueResolved ?? null,
        ]
      );
      return result.rows[0];
    },

    async listFeedbackForTicket(ticketId) {
      const result = await db.query(
        `SELECT * FROM support_feedback WHERE ticket_id = $1 ORDER BY created_at DESC`,
        [ticketId]
      );
      return result.rows;
    },

    /* =========================================================================
     * AUDIT
     * ====================================================================== */

    async insertAuditEvent(client, data) {
      await client.query(
        `
        INSERT INTO support_audit_events (
          actor_id, ticket_id, action, resource_type, resource_id, before, after, outcome
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          data.actorId || null,
          data.ticketId || null,
          data.action,
          data.resourceType,
          data.resourceId,
          data.before ? JSON.stringify(data.before) : null,
          data.after ? JSON.stringify(data.after) : null,
          data.outcome || 'success',
        ]
      );
    },

    /* =========================================================================
     * USAGE
     * ====================================================================== */

    async insertUsageEvent(client, data) {
      await client.query(
        `
        INSERT INTO support_usage_events (workspace_id, ticket_id, metric, amount)
        VALUES ($1, $2, $3, $4)
        `,
        [data.workspaceId || null, data.ticketId || null, data.metric, data.amount || 1]
      );
    },
  };
}

export default createSupportQueries;