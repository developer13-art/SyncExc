-- =============================================================================
-- 017_support.sql
-- Module 17 — Customer Support Portal
-- =============================================================================

CREATE TABLE support_ticket_categories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            text NOT NULL UNIQUE,
    label           text NOT NULL,
    parent_id       uuid REFERENCES support_ticket_categories(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_tickets (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference       text NOT NULL UNIQUE,
    requester_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
    subject         text NOT NULL,
    category        text NOT NULL,
    issue_type      text,
    description     text NOT NULL,
    impact          text,
    priority        text NOT NULL DEFAULT 'normal',
    status          text NOT NULL DEFAULT 'new',
    assigned_to_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    queue_id        uuid,
    affected_resource jsonb,
    occurrence_time timestamptz,
    preferred_language text NOT NULL DEFAULT 'en',
    first_response_at timestamptz,
    resolved_at     timestamptz,
    closed_at       timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT support_tickets_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CONSTRAINT support_tickets_status_check CHECK (status IN (
        'new', 'open', 'assigned', 'in_progress', 'waiting_for_customer',
        'waiting_for_internal_team', 'escalated', 'resolved', 'closed', 'reopened', 'canceled'
    ))
);

CREATE INDEX support_tickets_requester_idx ON support_tickets (requester_id, created_at DESC);
CREATE INDEX support_tickets_status_idx ON support_tickets (status, priority);
CREATE INDEX support_tickets_assigned_idx ON support_tickets (assigned_to_id) WHERE status NOT IN ('closed', 'canceled');

CREATE TRIGGER support_tickets_set_updated_at BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE support_ticket_status_history (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    previous_status text,
    new_status      text NOT NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    reason          text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_ticket_assignments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    assigned_to_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    queue_id        uuid,
    assigned_by     uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_ticket_participants (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            text NOT NULL DEFAULT 'participant',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (ticket_id, user_id)
);

CREATE TABLE support_ticket_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         text NOT NULL,
    is_edited       boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    edited_at       timestamptz
);

CREATE INDEX support_ticket_messages_ticket_idx ON support_ticket_messages (ticket_id, created_at);

CREATE TABLE support_ticket_internal_notes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author_id       uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content         text NOT NULL,
    mentions        uuid[] NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_ticket_attachments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    message_id      uuid REFERENCES support_ticket_messages(id) ON DELETE CASCADE,
    uploader_id     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    storage_key     text NOT NULL,
    file_name       text NOT NULL,
    mime_type       text NOT NULL,
    size_bytes      bigint NOT NULL,
    content_hash    text,
    scan_state      text NOT NULL DEFAULT 'pending',
    scan_result     jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT support_ticket_attachments_scan_check CHECK (scan_state IN (
        'pending', 'scanning', 'clean', 'infected', 'failed'
    ))
);

CREATE TABLE support_ticket_links (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    related_ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE,
    incident_id     uuid,
    resource_type   text,
    resource_id     uuid,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_ticket_tags (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    tag             text NOT NULL,
    UNIQUE (ticket_id, tag)
);

CREATE TABLE support_queues (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL UNIQUE,
    description     text,
    category        text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_queue_members (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id        uuid NOT NULL REFERENCES support_queues(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            text NOT NULL DEFAULT 'agent',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (queue_id, user_id)
);

CREATE TABLE support_escalation_policies (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category        text NOT NULL,
    priority        text NOT NULL,
    escalation_rules jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_escalation_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    policy_id       uuid REFERENCES support_escalation_policies(id) ON DELETE SET NULL,
    category        text NOT NULL,
    escalated_to    uuid REFERENCES users(id) ON DELETE SET NULL,
    reason          text,
    resolved_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_response_targets (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    priority        text NOT NULL UNIQUE,
    first_response_minutes integer NOT NULL,
    resolution_minutes integer NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_target_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    target_type     text NOT NULL,
    event_type      text NOT NULL,
    breached        boolean NOT NULL DEFAULT false,
    occurred_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT support_target_events_event_check CHECK (event_type IN ('started', 'paused', 'resumed', 'met', 'breached'))
);

CREATE TABLE support_diagnostic_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    requested_by    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    diagnostic_type text NOT NULL,
    scope           jsonb NOT NULL,
    status          text NOT NULL DEFAULT 'pending',
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    CONSTRAINT support_diagnostic_runs_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

CREATE TABLE support_diagnostic_results (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES support_diagnostic_runs(id) ON DELETE CASCADE,
    result          jsonb NOT NULL,
    sanitized       boolean NOT NULL DEFAULT true,
    observed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_incident_links (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     uuid NOT NULL,
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_articles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            text NOT NULL UNIQUE,
    title           text NOT NULL,
    state           text NOT NULL DEFAULT 'draft',
    current_version integer NOT NULL DEFAULT 1,
    category_id     uuid,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    published_at    timestamptz,
    archived_at     timestamptz,
    CONSTRAINT support_articles_state_check CHECK (state IN ('draft', 'in_review', 'published', 'needs_update', 'archived'))
);

CREATE TRIGGER support_articles_set_updated_at BEFORE UPDATE ON support_articles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE support_article_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id      uuid NOT NULL REFERENCES support_articles(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    content         text NOT NULL,
    summary         text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (article_id, version)
);

CREATE TABLE support_article_categories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            text NOT NULL UNIQUE,
    name            text NOT NULL,
    parent_id       uuid REFERENCES support_article_categories(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_article_feedback (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id      uuid NOT NULL REFERENCES support_articles(id) ON DELETE CASCADE,
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    helpful         boolean NOT NULL,
    comment         text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_search_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    query_text      text NOT NULL,
    result_count    integer NOT NULL DEFAULT 0,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_feedback (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score           integer,
    comment         text,
    issue_resolved  boolean,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT support_feedback_score_check CHECK (score IS NULL OR (score BETWEEN 1 AND 5))
);

CREATE TABLE support_saved_replies (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       uuid REFERENCES users(id) ON DELETE SET NULL,
    title           text NOT NULL,
    body            text NOT NULL,
    category        text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_ai_assist_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       uuid REFERENCES support_tickets(id) ON DELETE SET NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    feature         text NOT NULL,
    model           text,
    output          jsonb,
    reviewed        boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    ticket_id       uuid REFERENCES support_tickets(id) ON DELETE SET NULL,
    action          text NOT NULL,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    before          jsonb,
    after           jsonb,
    outcome         text NOT NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_usage_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
    ticket_id       uuid REFERENCES support_tickets(id) ON DELETE SET NULL,
    metric          text NOT NULL,
    amount          bigint NOT NULL DEFAULT 1,
    recorded_at     timestamptz NOT NULL DEFAULT now()
);