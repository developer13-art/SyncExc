-- =============================================================================
-- 007_risk.sql
-- Module 07 — Risk Management and Trading Safety
-- =============================================================================

-- -----------------------------------------------------------------------------
-- risk_policies
-- -----------------------------------------------------------------------------
CREATE TABLE risk_policies (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    name              text NOT NULL,
    scope             text NOT NULL,
    scope_ref         uuid,
    enforcement_mode  text NOT NULL,
    status            text NOT NULL DEFAULT 'draft',
    version           integer NOT NULL DEFAULT 1,
    created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT risk_policies_scope_check CHECK (scope IN (
        'platform', 'workspace', 'sync_group', 'exchange_account', 'instrument', 'operation'
    )),
    CONSTRAINT risk_policies_enforcement_check CHECK (enforcement_mode IN (
        'block', 'require_confirmation', 'require_additional_approval', 'warn', 'monitor_only'
    )),
    CONSTRAINT risk_policies_status_check CHECK (status IN ('draft', 'active', 'suspended', 'archived'))
);

CREATE INDEX risk_policies_workspace_idx ON risk_policies (workspace_id, status);
CREATE INDEX risk_policies_scope_idx ON risk_policies (scope, scope_ref) WHERE status = 'active';

CREATE TRIGGER risk_policies_set_updated_at BEFORE UPDATE ON risk_policies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- risk_policy_versions
-- -----------------------------------------------------------------------------
CREATE TABLE risk_policy_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id       uuid NOT NULL REFERENCES risk_policies(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    snapshot        jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (policy_id, version)
);

-- -----------------------------------------------------------------------------
-- risk_rule_definitions
-- -----------------------------------------------------------------------------
CREATE TABLE risk_rule_definitions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_type       text NOT NULL UNIQUE,
    description     text,
    config_schema   jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- risk_rule_configurations
-- -----------------------------------------------------------------------------
CREATE TABLE risk_rule_configurations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id       uuid NOT NULL REFERENCES risk_policies(id) ON DELETE CASCADE,
    rule_type       text NOT NULL REFERENCES risk_rule_definitions(rule_type) ON DELETE RESTRICT,
    config          jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX risk_rule_configurations_policy_idx ON risk_rule_configurations (policy_id);

-- -----------------------------------------------------------------------------
-- risk_limit_counters
-- -----------------------------------------------------------------------------
CREATE TABLE risk_limit_counters (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id       uuid NOT NULL REFERENCES risk_policies(id) ON DELETE CASCADE,
    scope_key       text NOT NULL,
    counter_type    text NOT NULL,
    window_start    timestamptz NOT NULL,
    window_end      timestamptz NOT NULL,
    current_value   numeric(30, 12) NOT NULL DEFAULT 0,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (policy_id, scope_key, counter_type, window_start)
);

-- -----------------------------------------------------------------------------
-- risk_evaluations
-- -----------------------------------------------------------------------------
CREATE TABLE risk_evaluations (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    operation_type        text NOT NULL,
    operation_payload     jsonb NOT NULL,
    outcome               text NOT NULL,
    reason_code           text,
    policy_version        text,
    evaluated_at          timestamptz NOT NULL DEFAULT now(),
    correlation_id        uuid,
    CONSTRAINT risk_evaluations_outcome_check CHECK (outcome IN (
        'approved', 'blocked', 'confirmation_required', 'approval_required',
        'data_unavailable', 'revalidation_required', 'monitoring_only'
    ))
);

CREATE INDEX risk_evaluations_workspace_idx ON risk_evaluations (workspace_id, evaluated_at DESC);

-- -----------------------------------------------------------------------------
-- risk_evaluation_results
-- -----------------------------------------------------------------------------
CREATE TABLE risk_evaluation_results (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id         uuid NOT NULL REFERENCES risk_evaluations(id) ON DELETE CASCADE,
    rule_type             text NOT NULL,
    result                text NOT NULL,
    measured_value        numeric(30, 12),
    limit_value           numeric(30, 12),
    reason                text
);

-- -----------------------------------------------------------------------------
-- risk_exposure_snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE risk_exposure_snapshots (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    scope_type      text NOT NULL,
    scope_id        uuid,
    gross_exposure  numeric(30, 12) NOT NULL DEFAULT 0,
    net_exposure    numeric(30, 12) NOT NULL DEFAULT 0,
    observed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX risk_exposure_snapshots_scope_idx ON risk_exposure_snapshots (scope_type, scope_id, observed_at DESC);

-- -----------------------------------------------------------------------------
-- risk_exposure_components
-- -----------------------------------------------------------------------------
CREATE TABLE risk_exposure_components (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id     uuid NOT NULL REFERENCES risk_exposure_snapshots(id) ON DELETE CASCADE,
    source_type     text NOT NULL,
    source_id       uuid,
    instrument      text,
    exposure        numeric(30, 12) NOT NULL,
    details         jsonb
);

-- -----------------------------------------------------------------------------
-- risk_reservations
-- -----------------------------------------------------------------------------
CREATE TABLE risk_reservations (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    scope_key             text NOT NULL,
    reservation_type      text NOT NULL,
    reserved_value        numeric(30, 12) NOT NULL,
    status                text NOT NULL DEFAULT 'active',
    operation_ref         uuid,
    expires_at            timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now(),
    released_at           timestamptz,
    CONSTRAINT risk_reservations_status_check CHECK (status IN ('active', 'consumed', 'released', 'expired'))
);

CREATE INDEX risk_reservations_scope_idx ON risk_reservations (workspace_id, scope_key) WHERE status = 'active';

-- -----------------------------------------------------------------------------
-- risk_approval_requests
-- -----------------------------------------------------------------------------
CREATE TABLE risk_approval_requests (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    evaluation_id         uuid NOT NULL REFERENCES risk_evaluations(id) ON DELETE CASCADE,
    operation_payload     jsonb NOT NULL,
    requested_by          uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status                text NOT NULL DEFAULT 'pending',
    expires_at            timestamptz NOT NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT risk_approval_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'canceled'))
);

CREATE INDEX risk_approval_requests_status_idx ON risk_approval_requests (status) WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- risk_approval_decisions
-- -----------------------------------------------------------------------------
CREATE TABLE risk_approval_decisions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      uuid NOT NULL REFERENCES risk_approval_requests(id) ON DELETE CASCADE,
    decision        text NOT NULL,
    decided_by      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason          text,
    decided_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT risk_approval_decisions_decision_check CHECK (decision IN ('approved', 'rejected'))
);

-- -----------------------------------------------------------------------------
-- risk_circuit_breakers
-- -----------------------------------------------------------------------------
CREATE TABLE risk_circuit_breakers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    scope_type      text NOT NULL,
    scope_id        uuid,
    trigger_type    text NOT NULL,
    state           text NOT NULL DEFAULT 'inactive',
    config          jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT risk_circuit_breakers_state_check CHECK (state IN ('inactive', 'active', 'resuming', 'resumed'))
);

CREATE TRIGGER risk_circuit_breakers_set_updated_at BEFORE UPDATE ON risk_circuit_breakers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- risk_circuit_breaker_events
-- -----------------------------------------------------------------------------
CREATE TABLE risk_circuit_breaker_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    breaker_id      uuid NOT NULL REFERENCES risk_circuit_breakers(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    reason          text,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- risk_emergency_pause_events
-- -----------------------------------------------------------------------------
CREATE TABLE risk_emergency_pause_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    scope_type      text NOT NULL,
    scope_id        uuid,
    status          text NOT NULL,
    reason          text NOT NULL,
    initiated_by    uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    resumed_at      timestamptz,
    CONSTRAINT risk_emergency_pause_status_check CHECK (status IN (
        'requested', 'propagating', 'active', 'resuming', 'resumed'
    ))
);

-- -----------------------------------------------------------------------------
-- risk_alerts
-- -----------------------------------------------------------------------------
CREATE TABLE risk_alerts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    severity        text NOT NULL,
    category        text NOT NULL,
    title           text NOT NULL,
    message         text,
    resource_type   text,
    resource_id     uuid,
    state           text NOT NULL DEFAULT 'open',
    acknowledged_by uuid REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at timestamptz,
    resolved_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT risk_alerts_severity_check CHECK (severity IN ('informational', 'warning', 'high', 'critical')),
    CONSTRAINT risk_alerts_state_check CHECK (state IN ('open', 'acknowledged', 'resolved'))
);

CREATE INDEX risk_alerts_workspace_idx ON risk_alerts (workspace_id, state, created_at DESC);

-- -----------------------------------------------------------------------------
-- execution_incidents
-- -----------------------------------------------------------------------------
CREATE TABLE execution_incidents (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    category              text NOT NULL,
    severity              text NOT NULL,
    status                text NOT NULL DEFAULT 'open',
    scope_type            text,
    scope_id              uuid,
    summary               text NOT NULL,
    assigned_to           uuid REFERENCES users(id) ON DELETE SET NULL,
    detected_at           timestamptz NOT NULL DEFAULT now(),
    resolved_at           timestamptz,
    closed_at             timestamptz,
    root_cause            text,
    prevention            text,
    CONSTRAINT execution_incidents_status_check CHECK (status IN ('open', 'investigating', 'contained', 'resolved', 'closed'))
);

CREATE INDEX execution_incidents_workspace_idx ON execution_incidents (workspace_id, status);

-- -----------------------------------------------------------------------------
-- execution_incident_events
-- -----------------------------------------------------------------------------
CREATE TABLE execution_incident_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     uuid NOT NULL REFERENCES execution_incidents(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    message         text,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- execution_incident_evidence
-- -----------------------------------------------------------------------------
CREATE TABLE execution_incident_evidence (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     uuid NOT NULL REFERENCES execution_incidents(id) ON DELETE CASCADE,
    kind            text NOT NULL,
    resource_type   text,
    resource_id     uuid,
    data            jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- execution_incident_actions
-- -----------------------------------------------------------------------------
CREATE TABLE execution_incident_actions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     uuid NOT NULL REFERENCES execution_incidents(id) ON DELETE CASCADE,
    action_type     text NOT NULL,
    payload         jsonb,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    outcome         text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- risk_audit_events
-- -----------------------------------------------------------------------------
CREATE TABLE risk_audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    action          text NOT NULL,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    before          jsonb,
    after           jsonb,
    outcome         text NOT NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);