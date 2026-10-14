-- =============================================================================
-- 020_events_audit.sql
-- Cross-cutting: outbox, audit, idempotency, rate-limit, jobs, subscriptions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- outbox_events (transactional outbox pattern)
-- -----------------------------------------------------------------------------
CREATE TABLE outbox_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      text NOT NULL,
    schema_version  text NOT NULL DEFAULT 'v1',
    payload         jsonb NOT NULL,
    correlation_id  uuid,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
    resource_type   text,
    resource_id     uuid,
    status          text NOT NULL DEFAULT 'pending',
    published_at    timestamptz,
    attempts        integer NOT NULL DEFAULT 0,
    last_error      text,
    occurred_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT outbox_events_status_check CHECK (status IN ('pending', 'published', 'failed', 'dead_lettered'))
);

CREATE INDEX outbox_events_pending_idx ON outbox_events (occurred_at) WHERE status = 'pending';
CREATE INDEX outbox_events_type_idx ON outbox_events (event_type, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- audit_events (global append-only audit trail)
-- -----------------------------------------------------------------------------
CREATE TABLE audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
    action          text NOT NULL,
    resource_type   text NOT NULL,
    resource_id     text NOT NULL,
    before          jsonb,
    after           jsonb,
    outcome         text NOT NULL,
    correlation_id  uuid,
    metadata        jsonb,
    ip              text,
    user_agent      text,
    occurred_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT audit_events_outcome_check CHECK (outcome IN ('success', 'failure', 'denied', 'partial'))
);

CREATE INDEX audit_events_actor_idx ON audit_events (actor_id, occurred_at DESC);
CREATE INDEX audit_events_workspace_idx ON audit_events (workspace_id, occurred_at DESC);
CREATE INDEX audit_events_resource_idx ON audit_events (resource_type, resource_id, occurred_at DESC);
CREATE INDEX audit_events_action_idx ON audit_events (action, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- idempotency_keys
-- -----------------------------------------------------------------------------
CREATE TABLE idempotency_keys (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key             text NOT NULL,
    scope           text NOT NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
    request_hash    text NOT NULL,
    state           text NOT NULL DEFAULT 'in_flight',
    response_status integer,
    response_body   jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (key, scope),
    CONSTRAINT idempotency_keys_state_check CHECK (state IN ('in_flight', 'completed', 'failed'))
);

CREATE INDEX idempotency_keys_updated_idx ON idempotency_keys (updated_at);

-- -----------------------------------------------------------------------------
-- rate_limit_states (for persistent token buckets if needed)
-- -----------------------------------------------------------------------------
CREATE TABLE rate_limit_states (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope           text NOT NULL,
    scope_key       text NOT NULL,
    window_start    timestamptz NOT NULL,
    window_end      timestamptz NOT NULL,
    current_count   integer NOT NULL DEFAULT 0,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (scope, scope_key, window_start)
);

-- -----------------------------------------------------------------------------
-- jobs (durable job queue)
-- -----------------------------------------------------------------------------
CREATE TABLE jobs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type        text NOT NULL,
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    status          text NOT NULL DEFAULT 'pending',
    priority        integer NOT NULL DEFAULT 100,
    attempts        integer NOT NULL DEFAULT 0,
    max_attempts    integer NOT NULL DEFAULT 5,
    scheduled_at    timestamptz NOT NULL DEFAULT now(),
    started_at      timestamptz,
    completed_at    timestamptz,
    last_error      text,
    dead_letter_at  timestamptz,
    correlation_id  uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT jobs_status_check CHECK (status IN (
        'pending', 'running', 'completed', 'failed', 'retry_scheduled', 'dead_lettered', 'canceled'
    ))
);

CREATE INDEX jobs_pending_idx ON jobs (scheduled_at) WHERE status IN ('pending', 'retry_scheduled');
CREATE INDEX jobs_type_idx ON jobs (job_type, created_at DESC);

-- -----------------------------------------------------------------------------
-- job_runs
-- -----------------------------------------------------------------------------
CREATE TABLE job_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    attempt_number  integer NOT NULL,
    worker_id       text,
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    outcome         text,
    error_message   text,
    duration_ms     integer,
    UNIQUE (job_id, attempt_number)
);

-- -----------------------------------------------------------------------------
-- event_subscriptions (for SNS/SQS-style internal routing)
-- -----------------------------------------------------------------------------
CREATE TABLE event_subscriptions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber      text NOT NULL,
    event_type      text NOT NULL,
    enabled         boolean NOT NULL DEFAULT true,
    filters         jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (subscriber, event_type)
);

-- -----------------------------------------------------------------------------
-- event_deliveries (internal delivery tracking)
-- -----------------------------------------------------------------------------
CREATE TABLE event_deliveries (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber      text NOT NULL,
    event_id        uuid NOT NULL,
    event_type      text NOT NULL,
    status          text NOT NULL DEFAULT 'pending',
    attempts        integer NOT NULL DEFAULT 0,
    last_error      text,
    next_attempt_at timestamptz,
    delivered_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_deliveries_pending_idx ON event_deliveries (next_attempt_at)
    WHERE status IN ('pending', 'retry_scheduled');