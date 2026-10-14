-- =============================================================================
-- 014_developer.sql
-- Module 14 — Developer Platform and Public API
-- =============================================================================

-- -----------------------------------------------------------------------------
-- developer_applications
-- -----------------------------------------------------------------------------
CREATE TABLE developer_applications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    owner_id        uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name            text NOT NULL,
    description     text,
    type            text NOT NULL,
    state           text NOT NULL DEFAULT 'draft',
    website         text,
    privacy_policy_url text,
    support_contact text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT developer_applications_type_check CHECK (type IN ('personal', 'organization', 'third_party')),
    CONSTRAINT developer_applications_state_check CHECK (state IN (
        'draft', 'active', 'restricted', 'suspended', 'revoked', 'archived'
    ))
);

CREATE INDEX developer_applications_workspace_idx ON developer_applications (workspace_id, state);

CREATE TRIGGER developer_applications_set_updated_at
    BEFORE UPDATE ON developer_applications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- developer_application_versions
-- -----------------------------------------------------------------------------
CREATE TABLE developer_application_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    snapshot        jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (application_id, version)
);

-- -----------------------------------------------------------------------------
-- developer_application_members
-- -----------------------------------------------------------------------------
CREATE TABLE developer_application_members (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (application_id, user_id)
);

-- -----------------------------------------------------------------------------
-- developer_application_permissions
-- -----------------------------------------------------------------------------
CREATE TABLE developer_application_permissions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
    permission_key  text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (application_id, permission_key)
);

-- -----------------------------------------------------------------------------
-- developer_application_redirect_uris
-- -----------------------------------------------------------------------------
CREATE TABLE developer_application_redirect_uris (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
    uri             text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (application_id, uri)
);

-- -----------------------------------------------------------------------------
-- developer_scope_grants
-- -----------------------------------------------------------------------------
CREATE TABLE developer_scope_grants (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
    scopes          text[] NOT NULL,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    granted_at      timestamptz NOT NULL DEFAULT now(),
    revoked_at      timestamptz
);

-- -----------------------------------------------------------------------------
-- developer_api_credentials
-- -----------------------------------------------------------------------------
CREATE TABLE developer_api_credentials (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
    environment     text NOT NULL,
    token_hash      text NOT NULL,
    token_prefix    text NOT NULL,
    scopes          text[] NOT NULL DEFAULT '{}',
    state           text NOT NULL DEFAULT 'active',
    expires_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_used_at    timestamptz,
    revoked_at      timestamptz,
    CONSTRAINT developer_api_credentials_environment_check CHECK (environment IN ('sandbox', 'production')),
    CONSTRAINT developer_api_credentials_state_check CHECK (state IN (
        'active', 'expired', 'rotation_pending', 'revoked', 'compromised'
    ))
);

CREATE UNIQUE INDEX developer_api_credentials_token_hash_unique ON developer_api_credentials (token_hash);
CREATE INDEX developer_api_credentials_application_idx ON developer_api_credentials (application_id, state);

-- -----------------------------------------------------------------------------
-- developer_credential_versions
-- -----------------------------------------------------------------------------
CREATE TABLE developer_credential_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id   uuid NOT NULL REFERENCES developer_api_credentials(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    action          text NOT NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    metadata        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- developer_oauth_clients
-- -----------------------------------------------------------------------------
CREATE TABLE developer_oauth_clients (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
    client_id       text NOT NULL UNIQUE,
    client_secret_ref text NOT NULL,
    redirect_uris   text[] NOT NULL,
    grant_types     text[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token'],
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- developer_oauth_grants
-- -----------------------------------------------------------------------------
CREATE TABLE developer_oauth_grants (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       uuid NOT NULL REFERENCES developer_oauth_clients(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    scopes          text[] NOT NULL,
    state           text NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now(),
    revoked_at      timestamptz,
    CONSTRAINT developer_oauth_grants_state_check CHECK (state IN ('active', 'revoked', 'expired'))
);

-- -----------------------------------------------------------------------------
-- developer_access_tokens
-- -----------------------------------------------------------------------------
CREATE TABLE developer_access_tokens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id        uuid NOT NULL REFERENCES developer_oauth_grants(id) ON DELETE CASCADE,
    token_hash      text NOT NULL,
    scopes          text[] NOT NULL,
    issued_at       timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz NOT NULL,
    revoked_at      timestamptz
);

CREATE UNIQUE INDEX developer_access_tokens_hash_unique ON developer_access_tokens (token_hash);

-- -----------------------------------------------------------------------------
-- developer_webhook_subscriptions
-- -----------------------------------------------------------------------------
CREATE TABLE developer_webhook_subscriptions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    destination_url text NOT NULL,
    event_types     text[] NOT NULL,
    resource_filters jsonb,
    state           text NOT NULL DEFAULT 'active',
    signing_secret_ref text NOT NULL,
    last_success_at timestamptz,
    last_failure_at timestamptz,
    consecutive_failures integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    suspended_at    timestamptz,
    CONSTRAINT developer_webhook_subscriptions_state_check CHECK (state IN (
        'active', 'paused', 'suspended', 'revoked'
    ))
);

CREATE INDEX developer_webhook_subscriptions_application_idx
    ON developer_webhook_subscriptions (application_id, state);

CREATE TRIGGER developer_webhook_subscriptions_set_updated_at
    BEFORE UPDATE ON developer_webhook_subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- developer_webhook_secret_refs
-- -----------------------------------------------------------------------------
CREATE TABLE developer_webhook_secret_refs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid NOT NULL REFERENCES developer_webhook_subscriptions(id) ON DELETE CASCADE,
    secret_ref      text NOT NULL,
    version         integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    rotated_at      timestamptz
);

-- -----------------------------------------------------------------------------
-- developer_webhook_events
-- -----------------------------------------------------------------------------
CREATE TABLE developer_webhook_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      text NOT NULL,
    schema_version  text NOT NULL,
    payload         jsonb NOT NULL,
    resource_type   text,
    resource_id     uuid,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX developer_webhook_events_created_idx ON developer_webhook_events (created_at DESC);

-- -----------------------------------------------------------------------------
-- developer_webhook_deliveries
-- -----------------------------------------------------------------------------
CREATE TABLE developer_webhook_deliveries (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid NOT NULL REFERENCES developer_webhook_subscriptions(id) ON DELETE CASCADE,
    event_id        uuid NOT NULL REFERENCES developer_webhook_events(id) ON DELETE CASCADE,
    state           text NOT NULL DEFAULT 'pending',
    attempt_number  integer NOT NULL DEFAULT 0,
    next_retry_at   timestamptz,
    last_response_status integer,
    last_response_snippet text,
    delivered_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT developer_webhook_deliveries_state_check CHECK (state IN (
        'pending', 'queued', 'delivering', 'delivered', 'retry_scheduled',
        'failed', 'dead_lettered', 'suspended'
    ))
);

CREATE INDEX developer_webhook_deliveries_pending_idx
    ON developer_webhook_deliveries (next_retry_at)
    WHERE state IN ('pending', 'retry_scheduled');

CREATE INDEX developer_webhook_deliveries_subscription_idx
    ON developer_webhook_deliveries (subscription_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- developer_webhook_delivery_attempts
-- -----------------------------------------------------------------------------
CREATE TABLE developer_webhook_delivery_attempts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id     uuid NOT NULL REFERENCES developer_webhook_deliveries(id) ON DELETE CASCADE,
    attempt_number  integer NOT NULL,
    request_headers jsonb,
    response_status integer,
    response_body_snippet text,
    duration_ms     integer,
    error_message   text,
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    UNIQUE (delivery_id, attempt_number)
);

-- -----------------------------------------------------------------------------
-- developer_webhook_event_schemas
-- -----------------------------------------------------------------------------
CREATE TABLE developer_webhook_event_schemas (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      text NOT NULL,
    version         text NOT NULL,
    schema          jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (event_type, version)
);

-- -----------------------------------------------------------------------------
-- developer_api_request_logs
-- -----------------------------------------------------------------------------
CREATE TABLE developer_api_request_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid REFERENCES developer_applications(id) ON DELETE SET NULL,
    credential_id   uuid REFERENCES developer_api_credentials(id) ON DELETE SET NULL,
    method          text NOT NULL,
    path            text NOT NULL,
    status          integer NOT NULL,
    duration_ms     integer NOT NULL,
    request_id      text,
    error_code      text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX developer_api_request_logs_application_idx
    ON developer_api_request_logs (application_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- developer_rate_limit_policies
-- -----------------------------------------------------------------------------
CREATE TABLE developer_rate_limit_policies (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope           text NOT NULL,
    limit_per_window integer NOT NULL,
    window_ms       integer NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (scope)
);

-- -----------------------------------------------------------------------------
-- developer_rate_limit_events
-- -----------------------------------------------------------------------------
CREATE TABLE developer_rate_limit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid REFERENCES developer_applications(id) ON DELETE SET NULL,
    credential_id   uuid REFERENCES developer_api_credentials(id) ON DELETE SET NULL,
    scope           text NOT NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- developer_usage_events
-- -----------------------------------------------------------------------------
CREATE TABLE developer_usage_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
    metric          text NOT NULL,
    amount          bigint NOT NULL DEFAULT 1,
    recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX developer_usage_events_application_idx
    ON developer_usage_events (application_id, recorded_at DESC);

-- -----------------------------------------------------------------------------
-- developer_sandbox_sessions
-- -----------------------------------------------------------------------------
CREATE TABLE developer_sandbox_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
    session_ref     text NOT NULL,
    expires_at      timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- developer_test_runs
-- -----------------------------------------------------------------------------
CREATE TABLE developer_test_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES developer_applications(id) ON DELETE CASCADE,
    session_id      uuid REFERENCES developer_sandbox_sessions(id) ON DELETE SET NULL,
    result          text NOT NULL,
    summary         jsonb,
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz
);

-- -----------------------------------------------------------------------------
-- developer_test_run_steps
-- -----------------------------------------------------------------------------
CREATE TABLE developer_test_run_steps (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id     uuid NOT NULL REFERENCES developer_test_runs(id) ON DELETE CASCADE,
    step_index      integer NOT NULL,
    name            text NOT NULL,
    result          text NOT NULL,
    details         jsonb
);

-- -----------------------------------------------------------------------------
-- developer_api_version_registry
-- -----------------------------------------------------------------------------
CREATE TABLE developer_api_version_registry (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version         text NOT NULL UNIQUE,
    released_at     timestamptz NOT NULL,
    deprecated_at   timestamptz,
    sunset_at       timestamptz
);

-- -----------------------------------------------------------------------------
-- developer_security_events
-- -----------------------------------------------------------------------------
CREATE TABLE developer_security_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid REFERENCES developer_applications(id) ON DELETE SET NULL,
    credential_id   uuid REFERENCES developer_api_credentials(id) ON DELETE SET NULL,
    event_type      text NOT NULL,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- developer_incidents
-- -----------------------------------------------------------------------------
CREATE TABLE developer_incidents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid REFERENCES developer_applications(id) ON DELETE SET NULL,
    category        text NOT NULL,
    severity        text NOT NULL,
    description     text NOT NULL,
    status          text NOT NULL DEFAULT 'open',
    opened_at       timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz
);

-- -----------------------------------------------------------------------------
-- developer_audit_events
-- -----------------------------------------------------------------------------
CREATE TABLE developer_audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    application_id  uuid REFERENCES developer_applications(id) ON DELETE SET NULL,
    action          text NOT NULL,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    before          jsonb,
    after           jsonb,
    outcome         text NOT NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);