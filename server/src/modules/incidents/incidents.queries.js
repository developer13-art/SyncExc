/**
 * SyncExc Server — Incidents queries
 */

export function createIncidentsQueries({ db }) {
  return {
    /* =========================================================================
     * INCIDENTS
     * ====================================================================== */

    async insertIncident(client, data) {
      const result = await client.query(
        `
        INSERT INTO platform_incidents (
          reference, title, severity, status, summary, affected_services,
          affected_features, incident_owner_id, customer_facing_status, started_at
        )
        VALUES ($1, $2, $3, 'investigating', $4, $5, $6, $7, $8, now())
        RETURNING *
        `,
        [
          data.reference,
          data.title,
          data.severity,
          data.summary,
          data.affectedServices || [],
          data.affectedFeatures || [],
          data.incidentOwnerId || null,
          data.customerFacingStatus ? JSON.stringify(data.customerFacingStatus) : null,
        ]
      );
      return result.rows[0];
    },

    async findIncidentById(incidentId) {
      const result = await db.query(
        `SELECT * FROM platform_incidents WHERE id = $1`,
        [incidentId]
      );
      return result.rows[0] || null;
    },

    async findIncidentByReference(reference) {
      const result = await db.query(
        `SELECT * FROM platform_incidents WHERE reference = $1`,
        [reference]
      );
      return result.rows[0] || null;
    },

    async listIncidents({ status, severity, limit = 50, cursor = null } = {}) {
      const params = [limit + 1];
      const conditions = [];
      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }
      if (severity) {
        params.push(severity);
        conditions.push(`severity = $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`started_at < $${params.length}`);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await db.query(
        `
        SELECT * FROM platform_incidents
        ${where}
        ORDER BY
          CASE severity
            WHEN 'sev1' THEN 1
            WHEN 'sev2' THEN 2
            WHEN 'sev3' THEN 3
            ELSE 4
          END ASC,
          started_at DESC
        LIMIT $1
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.started_at.toISOString() : null,
      };
    },

    async updateIncident(incidentId, fields) {
      const result = await db.query(
        `
        UPDATE platform_incidents
        SET title = COALESCE($2, title),
            severity = COALESCE($3, severity),
            status = COALESCE($4, status),
            summary = COALESCE($5, summary),
            affected_services = COALESCE($6, affected_services),
            affected_features = COALESCE($7, affected_features),
            incident_owner_id = COALESCE($8, incident_owner_id),
            customer_facing_status = COALESCE($9, customer_facing_status),
            resolved_at = COALESCE($10, resolved_at),
            closed_at = COALESCE($11, closed_at),
            post_mortem_ref = COALESCE($12, post_mortem_ref)
        WHERE id = $1
        RETURNING *
        `,
        [
          incidentId,
          fields.title ?? null,
          fields.severity ?? null,
          fields.status ?? null,
          fields.summary ?? null,
          fields.affectedServices ?? null,
          fields.affectedFeatures ?? null,
          fields.incidentOwnerId ?? null,
          fields.customerFacingStatus ? JSON.stringify(fields.customerFacingStatus) : null,
          fields.resolvedAt ?? null,
          fields.closedAt ?? null,
          fields.postMortemRef ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * INCIDENT EVENTS
     * ====================================================================== */

    async insertIncidentEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO platform_incident_events (
          incident_id, event_type, actor_id, message, metadata
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.incidentId,
          data.eventType,
          data.actorId || null,
          data.message || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    async listIncidentEvents(incidentId) {
      const result = await db.query(
        `
        SELECT * FROM platform_incident_events
        WHERE incident_id = $1
        ORDER BY occurred_at ASC
        `,
        [incidentId]
      );
      return result.rows;
    },

    /* =========================================================================
     * COMMENTS
     * ====================================================================== */

    async insertComment(client, data) {
      const result = await client.query(
        `
        INSERT INTO platform_incident_comments (
          incident_id, author_id, content, is_internal
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          data.incidentId,
          data.authorId,
          data.content,
          data.isInternal ?? true,
        ]
      );
      return result.rows[0];
    },

    async listComments(incidentId, { includeInternal = true } = {}) {
      const params = [incidentId];
      let internalClause = '';
      if (!includeInternal) {
        internalClause = `AND is_internal = false`;
      }
      const result = await db.query(
        `
        SELECT c.*, u.email AS author_email, u.display_name AS author_display_name
        FROM platform_incident_comments c
        JOIN users u ON u.id = c.author_id
        WHERE c.incident_id = $1 ${internalClause}
        ORDER BY c.created_at ASC
        `,
        params
      );
      return result.rows;
    },

    /* =========================================================================
     * TICKET LINKS
     * ========================================================================= */

    async insertTicketLink(client, data) {
      const result = await client.query(
        `
        INSERT INTO platform_incident_ticket_links (incident_id, ticket_id)
        VALUES ($1, $2)
        ON CONFLICT (incident_id, ticket_id) DO NOTHING
        RETURNING *
        `,
        [data.incidentId, data.ticketId]
      );
      return result.rows[0] || null;
    },

    async listTicketLinks(incidentId) {
      const result = await db.query(
        `
        SELECT l.*, t.reference AS ticket_reference, t.subject, t.status
        FROM platform_incident_ticket_links l
        JOIN support_tickets t ON t.id = l.ticket_id
        WHERE l.incident_id = $1
        `,
        [incidentId]
      );
      return result.rows;
    },

    /* =========================================================================
     * AFFECTED WORKSPACES
     * ====================================================================== */

    async upsertAffectedWorkspace(client, data) {
      const result = await client.query(
        `
        INSERT INTO platform_incident_affected_workspaces (
          incident_id, workspace_id, notified_at
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (incident_id, workspace_id) DO UPDATE SET
          notified_at = COALESCE(EXCLUDED.notified_at, platform_incident_affected_workspaces.notified_at)
        RETURNING *
        `,
        [data.incidentId, data.workspaceId, data.notifiedAt || null]
      );
      return result.rows[0];
    },

    async listAffectedWorkspaces(incidentId) {
      const result = await db.query(
        `
        SELECT a.*, w.name AS workspace_name
        FROM platform_incident_affected_workspaces a
        JOIN workspaces w ON w.id = a.workspace_id
        WHERE a.incident_id = $1
        `,
        [incidentId]
      );
      return result.rows;
    },
  };
}

export default createIncidentsQueries;