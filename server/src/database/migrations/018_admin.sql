-- =============================================================================
-- 018_admin.sql
-- Module 18 — Administrator Console
-- =============================================================================

CREATE TABLE admin_role_definitions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL UNIQUE,
    description     text NOT NULL,
    is_system       boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_permission_definitions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key  text NOT NULL UNIQUE,
    category        text NOT NULL,
    description     text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_role_permissions (
    role_id         uuid NOT NULL REFERENCES admin_role_definitions(id) ON DELETE CASCADE,
    permission_id   uuid NOT NULL REFERENCES admin_permission_definitions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE admin_user_role_assignments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id         uuid NOT NULL REFERENCES admin_role_definitions(id) ON DELETE CASCADE,
    scope_type      text,
    scope_id        uuid,
    assigned_by     uuid REFERENCES users(id) ON DELETE SET NULL,
    assigned_at     timestamptz NOT NULL DEFAULT now(),
    revoked_at      timestamptz,
    UNIQUE (user_id, role_id, scope_type, scope_id)
);

CREATE INDEX admin_user_role_assignments_user_idx ON admin_user_role_assignments (user_id) WHERE revoked_at IS NULL;

CREATE TABLE admin_access_grants (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    permissions     text[] NOT NULL,
    reason          text NOT NULL,
    approved_by     uuid REFERENCES users(id) ON DELETE SET NULL,
    expires_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    revoked_at      timestamptz
);

CREATE TABLE admin_approval_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type     text NOT NULL,
    action_payload  jsonb NOT NULL,
    requested_by    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status          text NOT NULL DEFAULT 'pending',
    reason          text,
    expires_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT admin_approval_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'canceled'))
);

CREATE INDEX admin_approval_requests_pending_idx ON admin_approval_requests (status) WHERE status = 'pending';

CREATE TABLE admin_approval_decisions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      uuid NOT NULL REFERENCES admin_approval_requests(id) ON DELETE CASCADE,
    decision        text NOT NULL,
    decided_by      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason          text,
    decided_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT admin_approval_decisions_decision_check CHECK (decision IN ('approved', 'rejected'))
);

CREATE TABLE admin_action_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action_type     text NOT NULL,
    payload         jsonb NOT NULL,
    approval_request_id uuid REFERENCES admin_approval_requests(id) ON DELETE SET NULL,
    status          text NOT NULL DEFAULT 'pending',
    result          jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz
);

CREATE TABLE admin_audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    actor_role_ref  text,
    workspace_id    uuid,
    action          text NOT NULL,
    target_resource text NOT NULL,
    target_id       text NOT NULL,
    reason          text,
    before          jsonb,
    after           jsonb,
    approval_ref    uuid,
    correlation_id  uuid,
    ip_address      text,
    user_agent      text,
    outcome         text NOT NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT admin_audit_events_outcome_check CHECK (outcome IN ('success', 'failure', 'denied', 'partial'))
);

CREATE INDEX admin_audit_events_actor_idx ON admin_audit_events (actor_id, occurred_at DESC);
CREATE INDEX admin_audit_events_resource_idx ON admin_audit_events (target_resource, target_id, occurred_at DESC);
CREATE INDEX admin_audit_events_action_idx ON admin_audit_events (action, occurred_at DESC);

CREATE TABLE admin_saved_views (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            text NOT NULL,
    resource_type   text NOT NULL,
    filters         jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, name, resource_type)
);

CREATE TABLE admin_dashboard_preferences (
    user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    layout          jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_alert_rules (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    metric_key      text NOT NULL,
    threshold       numeric(30, 12) NOT NULL,
    comparison      text NOT NULL,
    severity        text NOT NULL,
    enabled         boolean NOT NULL DEFAULT true,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT admin_alert_rules_comparison_check CHECK (comparison IN ('gt', 'gte', 'lt', 'lte', 'eq')),
    CONSTRAINT admin_alert_rules_severity_check CHECK (severity IN ('info', 'warning', 'high', 'critical'))
);

CREATE TRIGGER admin_alert_rules_set_updated_at BEFORE UPDATE ON admin_alert_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE admin_alert_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id         uuid REFERENCES admin_alert_rules(id) ON DELETE SET NULL,
    severity        text NOT NULL,
    message         text NOT NULL,
    state           text NOT NULL DEFAULT 'open',
    acknowledged_by uuid REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at timestamptz,
    resolved_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT admin_alert_events_state_check CHECK (state IN ('open', 'acknowledged', 'resolved'))
);

CREATE INDEX admin_alert_events_state_idx ON admin_alert_events (state, created_at DESC);

CREATE TABLE admin_feature_flags (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key             text NOT NULL UNIQUE,
    description     text NOT NULL,
    owning_team     text NOT NULL,
    related_module  text NOT NULL,
    type            text NOT NULL,
    default_value   boolean NOT NULL DEFAULT false,
    enabled         boolean NOT NULL DEFAULT false,
    environment     text NOT NULL,
    expires_at      timestamptz,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT admin_feature_flags_type_check CHECK (type IN (
        'release', 'operational_control', 'experiment', 'emergency_kill_switch'
    )),
    CONSTRAINT admin_feature_flags_environment_check CHECK (environment IN ('development', 'staging', 'production'))
);

CREATE TRIGGER admin_feature_flags_set_updated_at BEFORE UPDATE ON admin_feature_flags
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE admin_feature_flag_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id         uuid NOT NULL REFERENCES admin_feature_flags(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    snapshot        jsonb NOT NULL,
    published_by    uuid REFERENCES users(id) ON DELETE SET NULL,
    published_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (flag_id, version)
);

CREATE TABLE admin_feature_flag_rules (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id         uuid NOT NULL REFERENCES admin_feature_flags(id) ON DELETE CASCADE,
    rule_type       text NOT NULL,
    rule_config     jsonb NOT NULL,
    priority        integer NOT NULL DEFAULT 100,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_feature_flag_rules_flag_idx ON admin_feature_flag_rules (flag_id, priority);

CREATE TABLE admin_feature_flag_evaluations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key        text NOT NULL,
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
    result          boolean NOT NULL,
    reason          text NOT NULL,
    evaluated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_feature_flag_evaluations_flag_idx
    ON admin_feature_flag_evaluations (flag_key, evaluated_at DESC);

CREATE TABLE admin_rollout_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id         uuid NOT NULL REFERENCES admin_feature_flags(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    previous_state  jsonb,
    new_state       jsonb,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    reason          text,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_exports (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type   text NOT NULL,
    filters         jsonb,
    status          text NOT NULL DEFAULT 'pending',
    storage_key     text,
    row_count       integer,
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    downloaded_at   timestamptz,
    CONSTRAINT admin_exports_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired'))
);

CREATE INDEX admin_exports_user_idx ON admin_exports (user_id, created_at DESC);

CREATE TABLE admin_data_access_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    access_type     text NOT NULL,
    reason          text,
    occurred_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT admin_data_access_events_access_check CHECK (access_type IN ('view', 'export', 'diagnostic'))
);

CREATE TABLE admin_operation_jobs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type        text NOT NULL,
    created_by      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    scope           jsonb NOT NULL,
    state           text NOT NULL DEFAULT 'queued',
    progress        numeric(5, 2) NOT NULL DEFAULT 0,
    items_total     integer,
    items_succeeded integer NOT NULL DEFAULT 0,
    items_failed    integer NOT NULL DEFAULT 0,
    items_skipped   integer NOT NULL DEFAULT 0,
    retry_count     integer NOT NULL DEFAULT 0,
    last_error      text,
    rollback_ref    uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    started_at      timestamptz,
    completed_at    timestamptz,
    CONSTRAINT admin_operation_jobs_state_check CHECK (state IN (
        'queued', 'validating', 'running', 'waiting_for_approval', 'partially_succeeded',
        'succeeded', 'failed', 'cancellation_requested', 'canceled', 'reconciliation_required'
    ))
);

CREATE INDEX admin_operation_jobs_state_idx ON admin_operation_jobs (state, created_at);

CREATE TABLE admin_operation_job_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          uuid NOT NULL REFERENCES admin_operation_jobs(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    payload         jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_operation_job_events_job_idx ON admin_operation_job_events (job_id, occurred_at);