-- =============================================================================
-- 019_incidents.sql
-- Platform Incident Management (cross-cutting)
-- =============================================================================

CREATE TABLE platform_incidents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference       text NOT NULL UNIQUE,
    title           text NOT NULL,
    severity        text NOT NULL,
    status          text NOT NULL DEFAULT 'investigating',
    summary         text NOT NULL,
    affected_services text[] NOT NULL DEFAULT '{}',
    affected_features text[] NOT NULL DEFAULT '{}',
    incident_owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
    customer_facing_status jsonb,
    started_at      timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz,
    closed_at       timestamptz,
    post_mortem_ref text,
    CONSTRAINT platform_incidents_severity_check CHECK (severity IN ('sev1', 'sev2', 'sev3', 'sev4')),
    CONSTRAINT platform_incidents_status_check CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved'))
);

CREATE INDEX platform_incidents_status_idx ON platform_incidents (status, started_at DESC);

CREATE TABLE platform_incident_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     uuid NOT NULL REFERENCES platform_incidents(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    message         text,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_incident_events_incident_idx
    ON platform_incident_events (incident_id, occurred_at);

CREATE TABLE platform_incident_comments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     uuid NOT NULL REFERENCES platform_incidents(id) ON DELETE CASCADE,
    author_id       uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content         text NOT NULL,
    is_internal     boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_incident_ticket_links (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     uuid NOT NULL REFERENCES platform_incidents(id) ON DELETE CASCADE,
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (incident_id, ticket_id)
);

CREATE TABLE platform_incident_affected_workspaces (
    incident_id     uuid NOT NULL REFERENCES platform_incidents(id) ON DELETE CASCADE,
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    notified_at     timestamptz,
    PRIMARY KEY (incident_id, workspace_id)
);