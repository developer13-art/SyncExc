-- =============================================================================
-- 009_signals.sql
-- Module 09 — AI Signal Intelligence and Processing
-- =============================================================================

-- -----------------------------------------------------------------------------
-- signal_messages
-- -----------------------------------------------------------------------------
CREATE TABLE signal_messages (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id             uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    provider_message_id   text,
    channel_ref           text,
    provider_timestamp    timestamptz NOT NULL,
    received_at           timestamptz NOT NULL DEFAULT now(),
    content_type          text NOT NULL,
    content               text NOT NULL,
    content_hash          text NOT NULL,
    current_version       integer NOT NULL DEFAULT 1,
    processing_status     text NOT NULL DEFAULT 'received',
    metadata              jsonb,
    CONSTRAINT signal_messages_content_type_check CHECK (content_type IN ('text', 'structured', 'attachment', 'mixed')),
    CONSTRAINT signal_messages_status_check CHECK (processing_status IN (
        'received', 'duplicated', 'processing', 'review_required', 'validating',
        'eligible', 'blocked', 'expired', 'canceled', 'rejected', 'failed'
    ))
);

CREATE INDEX signal_messages_source_idx ON signal_messages (source_id, received_at DESC);
CREATE INDEX signal_messages_status_idx ON signal_messages (processing_status);
CREATE UNIQUE INDEX signal_messages_provider_unique
    ON signal_messages (source_id, provider_message_id)
    WHERE provider_message_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- signal_message_versions
-- -----------------------------------------------------------------------------
CREATE TABLE signal_message_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      uuid NOT NULL REFERENCES signal_messages(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    content         text NOT NULL,
    content_hash    text NOT NULL,
    change_reason   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (message_id, version)
);

-- -----------------------------------------------------------------------------
-- signal_message_deduplication
-- -----------------------------------------------------------------------------
CREATE TABLE signal_message_deduplication (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dedup_key       text NOT NULL UNIQUE,
    scope           text NOT NULL,
    message_id      uuid REFERENCES signal_messages(id) ON DELETE CASCADE,
    decision        text NOT NULL,
    reason          text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT signal_message_deduplication_decision_check CHECK (decision IN ('duplicate', 'candidate_duplicate', 'unique'))
);

-- -----------------------------------------------------------------------------
-- signal_processing_jobs
-- -----------------------------------------------------------------------------
CREATE TABLE signal_processing_jobs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      uuid NOT NULL REFERENCES signal_messages(id) ON DELETE CASCADE,
    job_type        text NOT NULL,
    status          text NOT NULL DEFAULT 'queued',
    attempts        integer NOT NULL DEFAULT 0,
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    started_at      timestamptz,
    completed_at    timestamptz,
    CONSTRAINT signal_processing_jobs_status_check CHECK (status IN (
        'queued', 'processing', 'completed', 'failed', 'retry_scheduled', 'dead_lettered', 'canceled'
    ))
);

CREATE INDEX signal_processing_jobs_status_idx ON signal_processing_jobs (status, created_at);

-- -----------------------------------------------------------------------------
-- signal_processing_runs
-- -----------------------------------------------------------------------------
CREATE TABLE signal_processing_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          uuid NOT NULL REFERENCES signal_processing_jobs(id) ON DELETE CASCADE,
    parser_version  text,
    ai_model        text,
    schema_version  text NOT NULL,
    output          jsonb NOT NULL,
    duration_ms     integer NOT NULL,
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- signal_parser_definitions
-- -----------------------------------------------------------------------------
CREATE TABLE signal_parser_definitions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL UNIQUE,
    description     text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- signal_parser_versions
-- -----------------------------------------------------------------------------
CREATE TABLE signal_parser_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parser_id       uuid NOT NULL REFERENCES signal_parser_definitions(id) ON DELETE CASCADE,
    version         text NOT NULL,
    config          jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (parser_id, version)
);

-- -----------------------------------------------------------------------------
-- signal_ai_processing_records
-- -----------------------------------------------------------------------------
CREATE TABLE signal_ai_processing_records (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    processing_run_id uuid NOT NULL REFERENCES signal_processing_runs(id) ON DELETE CASCADE,
    provider        text NOT NULL,
    model           text NOT NULL,
    prompt_version  text NOT NULL,
    response_schema_version text NOT NULL,
    tokens_input    integer,
    tokens_output   integer,
    raw_response    jsonb,
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- trading_signal_candidates
-- -----------------------------------------------------------------------------
CREATE TABLE trading_signal_candidates (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id             uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
    message_id            uuid NOT NULL REFERENCES signal_messages(id) ON DELETE CASCADE,
    instrument            text NOT NULL,
    market_type           text,
    direction             text NOT NULL,
    entry                 numeric(30, 12),
    entry_range           jsonb,
    stop_loss             numeric(30, 12),
    leverage              numeric(20, 6),
    status                text NOT NULL DEFAULT 'received',
    current_version       integer NOT NULL DEFAULT 1,
    eligibility_outcome   text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trading_signal_candidates_direction_check CHECK (direction IN ('long', 'short')),
    CONSTRAINT trading_signal_candidates_status_check CHECK (status IN (
        'received', 'deduplicated', 'processing', 'review_required', 'validating',
        'eligible', 'blocked', 'expired', 'canceled', 'rejected', 'failed'
    ))
);

CREATE INDEX trading_signal_candidates_source_idx ON trading_signal_candidates (source_id, created_at DESC);
CREATE INDEX trading_signal_candidates_message_idx ON trading_signal_candidates (message_id);
CREATE INDEX trading_signal_candidates_status_idx ON trading_signal_candidates (status);

CREATE TRIGGER trading_signal_candidates_set_updated_at BEFORE UPDATE ON trading_signal_candidates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- trading_signal_versions
-- -----------------------------------------------------------------------------
CREATE TABLE trading_signal_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    uuid NOT NULL REFERENCES trading_signal_candidates(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    snapshot        jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (candidate_id, version)
);

-- -----------------------------------------------------------------------------
-- trading_signal_fields
-- -----------------------------------------------------------------------------
CREATE TABLE trading_signal_fields (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    uuid NOT NULL REFERENCES trading_signal_candidates(id) ON DELETE CASCADE,
    field_name      text NOT NULL,
    value           jsonb,
    provenance      text NOT NULL,
    evidence        jsonb,
    confidence      text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- trading_signal_targets
-- -----------------------------------------------------------------------------
CREATE TABLE trading_signal_targets (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    uuid NOT NULL REFERENCES trading_signal_candidates(id) ON DELETE CASCADE,
    ordinal         integer NOT NULL,
    label           text,
    value           numeric(30, 12) NOT NULL,
    UNIQUE (candidate_id, ordinal)
);

-- -----------------------------------------------------------------------------
-- trading_signal_issues
-- -----------------------------------------------------------------------------
CREATE TABLE trading_signal_issues (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    uuid NOT NULL REFERENCES trading_signal_candidates(id) ON DELETE CASCADE,
    issue_type      text NOT NULL,
    severity        text NOT NULL,
    affected_fields text[],
    evidence        jsonb,
    detection_method text NOT NULL,
    resolved_at     timestamptz,
    resolution      jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trading_signal_issues_type_check CHECK (issue_type IN (
        'missing_field', 'ambiguous_value', 'contradictory_value', 'stale_information',
        'expired_signal', 'canceled_signal', 'invalid_value'
    )),
    CONSTRAINT trading_signal_issues_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX trading_signal_issues_candidate_idx ON trading_signal_issues (candidate_id) WHERE resolved_at IS NULL;

-- -----------------------------------------------------------------------------
-- trading_signal_relationships
-- -----------------------------------------------------------------------------
CREATE TABLE trading_signal_relationships (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    uuid NOT NULL REFERENCES trading_signal_candidates(id) ON DELETE CASCADE,
    related_candidate_id uuid NOT NULL REFERENCES trading_signal_candidates(id) ON DELETE CASCADE,
    relationship_type text NOT NULL,
    confidence      numeric(5, 2),
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (candidate_id, related_candidate_id, relationship_type)
);

-- -----------------------------------------------------------------------------
-- trading_signal_reviews
-- -----------------------------------------------------------------------------
CREATE TABLE trading_signal_reviews (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    uuid NOT NULL REFERENCES trading_signal_candidates(id) ON DELETE CASCADE,
    reviewer_id     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    decision        text NOT NULL,
    corrections     jsonb,
    reason          text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trading_signal_reviews_decision_check CHECK (decision IN (
        'confirm', 'correct', 'reject', 'link_update', 'request_more_info'
    ))
);

-- -----------------------------------------------------------------------------
-- trading_signal_corrections
-- -----------------------------------------------------------------------------
CREATE TABLE trading_signal_corrections (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    uuid NOT NULL REFERENCES trading_signal_candidates(id) ON DELETE CASCADE,
    reviewer_id     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    field_name      text NOT NULL,
    before_value    jsonb,
    after_value     jsonb,
    reason          text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- trading_signal_validations
-- -----------------------------------------------------------------------------
CREATE TABLE trading_signal_validations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    uuid NOT NULL REFERENCES trading_signal_candidates(id) ON DELETE CASCADE,
    rule_set_version text NOT NULL,
    outcome         text NOT NULL,
    summary         jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trading_signal_validations_candidate_idx ON trading_signal_validations (candidate_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- trading_signal_validation_results
-- -----------------------------------------------------------------------------
CREATE TABLE trading_signal_validation_results (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_id   uuid NOT NULL REFERENCES trading_signal_validations(id) ON DELETE CASCADE,
    check_key       text NOT NULL,
    result          text NOT NULL,
    severity        text,
    message         text,
    remediation     text
);

-- -----------------------------------------------------------------------------
-- trading_signal_eligibility_decisions
-- -----------------------------------------------------------------------------
CREATE TABLE trading_signal_eligibility_decisions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    uuid NOT NULL REFERENCES trading_signal_candidates(id) ON DELETE CASCADE,
    outcome         text NOT NULL,
    rule_set_version text NOT NULL,
    reasons         jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trading_signal_eligibility_decisions_outcome_check CHECK (outcome IN (
        'eligible_for_handoff', 'review_required', 'blocked_invalid', 'blocked_state',
        'blocked_canceled', 'blocked_source', 'blocked_duplicate',
        'waiting_for_data', 'waiting_for_authorization'
    ))
);

-- -----------------------------------------------------------------------------
-- trading_execution_intents
-- -----------------------------------------------------------------------------
CREATE TABLE trading_execution_intents (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id             uuid NOT NULL REFERENCES trading_signal_candidates(id) ON DELETE RESTRICT,
    signal_version        integer NOT NULL,
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    sync_group_id         uuid REFERENCES sync_groups(id) ON DELETE SET NULL,
    operation_type        text NOT NULL,
    payload               jsonb NOT NULL,
    eligibility_decision_id uuid REFERENCES trading_signal_eligibility_decisions(id) ON DELETE SET NULL,
    risk_evaluation_id    uuid REFERENCES risk_evaluations(id) ON DELETE SET NULL,
    idempotency_key       text NOT NULL UNIQUE,
    correlation_id        uuid,
    status                text NOT NULL DEFAULT 'created',
    expires_at            timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now(),
    completed_at          timestamptz,
    CONSTRAINT trading_execution_intents_status_check CHECK (status IN (
        'created', 'held', 'dispatched', 'canceled', 'expired', 'completed', 'failed'
    ))
);

CREATE INDEX trading_execution_intents_workspace_idx ON trading_execution_intents (workspace_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- trading_execution_intent_events
-- -----------------------------------------------------------------------------
CREATE TABLE trading_execution_intent_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    intent_id       uuid NOT NULL REFERENCES trading_execution_intents(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- signal_processing_audit_events
-- -----------------------------------------------------------------------------
CREATE TABLE signal_processing_audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    action          text NOT NULL,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    before          jsonb,
    after           jsonb,
    outcome         text NOT NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);