-- =============================================================================
-- 008_sources.sql
-- Module 08 — Signal Source Discovery, Addition and Management
-- =============================================================================

-- -----------------------------------------------------------------------------
-- signal_sources
-- -----------------------------------------------------------------------------
CREATE TABLE signal_sources (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    owner_id          uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type              text NOT NULL,
    name              text NOT NULL,
    status            text NOT NULL DEFAULT 'draft',
    url               text,
    provider_name     text,
    health_state      text,
    quality_state     text,
    current_version   integer NOT NULL DEFAULT 1,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    archived_at       timestamptz,
    CONSTRAINT signal_sources_type_check CHECK (type IN (
        'telegram', 'discord', 'whatsapp', 'webhook', 'website', 'rest_api', 'email'
    )),
    CONSTRAINT signal_sources_status_check CHECK (status IN (
        'draft', 'pending_validation', 'pending_review', 'approved', 'active',
        'paused', 'restricted', 'suspended', 'archived', 'rejected'
    )),
    CONSTRAINT signal_sources_health_check CHECK (health_state IS NULL OR health_state IN (
        'healthy', 'degraded', 'stale', 'disconnected', 'authorization_required',
        'rate_limited', 'validation_required', 'disabled'
    )),
    CONSTRAINT signal_sources_quality_check CHECK (quality_state IS NULL OR quality_state IN (
        'insufficient_data', 'under_observation', 'established', 'degraded'
    ))
);

CREATE INDEX signal_sources_workspace_idx ON signal_sources (workspace_id, status);
CREATE INDEX signal_sources_status_idx ON signal_sources (status);

CREATE TRIGGER signal_sources_set_updated_at BEFORE UPDATE ON signal_sources
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- signal_source_versions
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    snapshot        jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_id, version)
);

-- -----------------------------------------------------------------------------
-- signal_source_identifiers
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_identifiers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    identifier_type text NOT NULL,
    value           text NOT NULL,
    canonical       boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_id, identifier_type, value)
);

-- -----------------------------------------------------------------------------
-- source_categories
-- -----------------------------------------------------------------------------
CREATE TABLE source_categories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_group  text NOT NULL,
    code            text NOT NULL,
    label           text NOT NULL,
    UNIQUE (category_group, code)
);

-- -----------------------------------------------------------------------------
-- signal_source_category_assignments
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_category_assignments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    category_id     uuid NOT NULL REFERENCES source_categories(id) ON DELETE CASCADE,
    provenance      text NOT NULL DEFAULT 'user_provided',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_id, category_id),
    CONSTRAINT signal_source_category_assignments_prov CHECK (provenance IN (
        'user_provided', 'provider_reported', 'system_observed', 'ai_inferred', 'admin_verified'
    ))
);

-- -----------------------------------------------------------------------------
-- signal_source_metadata_evidence
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_metadata_evidence (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    field_name      text NOT NULL,
    value           jsonb,
    provenance      text NOT NULL,
    evidence        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- signal_source_tags
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_tags (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    tag             text NOT NULL,
    UNIQUE (source_id, tag)
);

-- -----------------------------------------------------------------------------
-- signal_source_connections
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_connections (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    adapter_type    text NOT NULL,
    status          text NOT NULL DEFAULT 'pending',
    authorization_status text,
    metadata        jsonb,
    last_validated_at timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT signal_source_connections_status_check CHECK (status IN (
        'pending', 'active', 'degraded', 'disconnected', 'revoked', 'error'
    ))
);

CREATE TRIGGER signal_source_connections_set_updated_at BEFORE UPDATE ON signal_source_connections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- signal_source_credentials (encrypted)
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_credentials (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   uuid NOT NULL REFERENCES signal_source_connections(id) ON DELETE CASCADE,
    credential_type text NOT NULL,
    encrypted_value text NOT NULL,
    key_version     text NOT NULL DEFAULT '1',
    created_at      timestamptz NOT NULL DEFAULT now(),
    revoked_at      timestamptz
);

-- -----------------------------------------------------------------------------
-- signal_source_permissions
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_permissions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    permission_key  text NOT NULL,
    scope           text,
    granted_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_id, permission_key, scope)
);

-- -----------------------------------------------------------------------------
-- signal_source_discovery_jobs
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_discovery_jobs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    initiated_by    uuid REFERENCES users(id) ON DELETE SET NULL,
    filters         jsonb NOT NULL,
    status          text NOT NULL DEFAULT 'pending',
    candidates_found integer NOT NULL DEFAULT 0,
    error_message   text,
    started_at      timestamptz,
    completed_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT signal_source_discovery_jobs_status_check CHECK (status IN (
        'pending', 'running', 'completed', 'failed', 'canceled'
    ))
);

CREATE INDEX signal_source_discovery_jobs_workspace_idx ON signal_source_discovery_jobs (workspace_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- signal_source_candidates
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_candidates (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    discovery_job_id   uuid REFERENCES signal_source_discovery_jobs(id) ON DELETE SET NULL,
    workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name               text NOT NULL,
    url                text,
    identifier         text,
    type               text,
    status             text NOT NULL DEFAULT 'new',
    confidence_score   numeric(5, 2),
    evidence           jsonb,
    metadata           jsonb,
    discovered_at      timestamptz NOT NULL DEFAULT now(),
    reviewed_at        timestamptz,
    CONSTRAINT signal_source_candidates_status_check CHECK (status IN (
        'new', 'pending_review', 'under_review', 'approved_for_validation',
        'validation_in_progress', 'approved', 'rejected', 'additional_information_required',
        'suspended', 'archived'
    ))
);

CREATE INDEX signal_source_candidates_workspace_idx ON signal_source_candidates (workspace_id, status);

-- -----------------------------------------------------------------------------
-- signal_source_discovery_evidence
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_discovery_evidence (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    uuid NOT NULL REFERENCES signal_source_candidates(id) ON DELETE CASCADE,
    kind            text NOT NULL,
    data            jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- signal_source_reviews
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_reviews (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid REFERENCES signal_sources(id) ON DELETE CASCADE,
    candidate_id    uuid REFERENCES signal_source_candidates(id) ON DELETE CASCADE,
    reviewer_id     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    decision        text NOT NULL,
    scope           text,
    reason          text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT signal_source_reviews_decision_check CHECK (decision IN (
        'approve', 'reject', 'request_information', 'suspend'
    )),
    CONSTRAINT signal_source_reviews_target_check CHECK (
        source_id IS NOT NULL OR candidate_id IS NOT NULL
    )
);

-- -----------------------------------------------------------------------------
-- signal_source_validations
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_validations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    overall_result  text NOT NULL,
    adapter_version text,
    parser_version  text,
    summary         jsonb,
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz
);

CREATE INDEX signal_source_validations_source_idx ON signal_source_validations (source_id, started_at DESC);

-- -----------------------------------------------------------------------------
-- signal_source_validation_checks
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_validation_checks (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_id   uuid NOT NULL REFERENCES signal_source_validations(id) ON DELETE CASCADE,
    stage           text NOT NULL,
    result          text NOT NULL,
    message         text,
    evidence        jsonb
);

-- -----------------------------------------------------------------------------
-- signal_source_health_snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_health_snapshots (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    state           text NOT NULL,
    last_event_at   timestamptz,
    error_count     integer NOT NULL DEFAULT 0,
    metadata        jsonb,
    observed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX signal_source_health_snapshots_source_idx ON signal_source_health_snapshots (source_id, observed_at DESC);

-- -----------------------------------------------------------------------------
-- signal_source_quality_snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_quality_snapshots (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    completeness    numeric(5, 2),
    parsing_success numeric(5, 2),
    freshness_ms    bigint,
    duplicate_rate  numeric(5, 2),
    invalid_rate    numeric(5, 2),
    sample_count    integer NOT NULL DEFAULT 0,
    observation_start timestamptz,
    observation_end timestamptz,
    observed_at     timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- signal_source_observations
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_observations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    observed_at     timestamptz NOT NULL DEFAULT now(),
    event_count     integer NOT NULL DEFAULT 0,
    valid_count     integer NOT NULL DEFAULT 0,
    invalid_count   integer NOT NULL DEFAULT 0,
    duplicate_count integer NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
-- signal_source_parsers
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_parsers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    name            text NOT NULL,
    parser_type     text NOT NULL,
    current_version integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- signal_source_parser_versions
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_parser_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parser_id       uuid NOT NULL REFERENCES signal_source_parsers(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    config          jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (parser_id, version)
);

-- -----------------------------------------------------------------------------
-- signal_source_parser_test_runs
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_parser_test_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parser_id       uuid NOT NULL REFERENCES signal_source_parsers(id) ON DELETE CASCADE,
    parser_version  integer NOT NULL,
    sample_input    jsonb NOT NULL,
    parsed_output   jsonb,
    result          text NOT NULL,
    duration_ms     integer,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT signal_source_parser_test_runs_result_check CHECK (result IN ('pass', 'fail', 'partial'))
);

-- -----------------------------------------------------------------------------
-- signal_source_relationships
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_relationships (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    related_source_id uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    relationship_type text NOT NULL,
    confidence      numeric(5, 2),
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_id, related_source_id, relationship_type)
);

-- -----------------------------------------------------------------------------
-- signal_source_shares
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_shares (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    shared_with_workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    permissions     text[] NOT NULL,
    granted_by      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at      timestamptz NOT NULL DEFAULT now(),
    revoked_at      timestamptz
);

CREATE INDEX signal_source_shares_workspace_idx ON signal_source_shares (shared_with_workspace_id)
    WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- signal_source_lifecycle_events
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_lifecycle_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    reason          text,
    metadata        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- signal_source_ingestion_cursors
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_ingestion_cursors (
    source_id       uuid PRIMARY KEY REFERENCES signal_sources(id) ON DELETE CASCADE,
    adapter_type    text NOT NULL,
    cursor_value    text,
    last_event_at   timestamptz,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- signal_source_ingestion_metrics
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_ingestion_metrics (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    period_start    timestamptz NOT NULL,
    period_end      timestamptz NOT NULL,
    events_received integer NOT NULL DEFAULT 0,
    events_processed integer NOT NULL DEFAULT 0,
    avg_latency_ms  integer,
    UNIQUE (source_id, period_start, period_end)
);

-- -----------------------------------------------------------------------------
-- signal_source_alerts
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_alerts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    category        text NOT NULL,
    severity        text NOT NULL,
    message         text,
    state           text NOT NULL DEFAULT 'open',
    created_at      timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz,
    CONSTRAINT signal_source_alerts_state_check CHECK (state IN ('open', 'acknowledged', 'resolved'))
);

-- -----------------------------------------------------------------------------
-- signal_source_audit_events
-- -----------------------------------------------------------------------------
CREATE TABLE signal_source_audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid REFERENCES signal_sources(id) ON DELETE SET NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    action          text NOT NULL,
    resource_type   text NOT NULL,
    resource_id     uuid,
    before          jsonb,
    after           jsonb,
    outcome         text NOT NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);