-- =============================================================================
-- 011_automation.sql
-- Module 11 — Automation Studio
-- =============================================================================

-- -----------------------------------------------------------------------------
-- automation_workflows
-- -----------------------------------------------------------------------------
CREATE TABLE automation_workflows (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name            text NOT NULL,
    description     text,
    status          text NOT NULL DEFAULT 'draft',
    current_version integer NOT NULL DEFAULT 0,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    archived_at     timestamptz,
    CONSTRAINT automation_workflows_status_check CHECK (status IN (
        'draft', 'validated', 'published', 'active', 'paused', 'retired',
        'validation_failed', 'needs_attention'
    ))
);

CREATE INDEX automation_workflows_workspace_idx ON automation_workflows (workspace_id, status);

CREATE TRIGGER automation_workflows_set_updated_at BEFORE UPDATE ON automation_workflows
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- automation_workflow_versions
-- -----------------------------------------------------------------------------
CREATE TABLE automation_workflow_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     uuid NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    definition      jsonb NOT NULL,
    is_published    boolean NOT NULL DEFAULT false,
    published_at    timestamptz,
    published_by    uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workflow_id, version)
);

CREATE INDEX automation_workflow_versions_published_idx ON automation_workflow_versions (workflow_id)
    WHERE is_published = true;

-- -----------------------------------------------------------------------------
-- automation_workflow_nodes
-- -----------------------------------------------------------------------------
CREATE TABLE automation_workflow_nodes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id      uuid NOT NULL REFERENCES automation_workflow_versions(id) ON DELETE CASCADE,
    node_id         text NOT NULL,
    node_type       text NOT NULL,
    category        text NOT NULL,
    config          jsonb NOT NULL DEFAULT '{}'::jsonb,
    position        jsonb,
    UNIQUE (version_id, node_id)
);

-- -----------------------------------------------------------------------------
-- automation_workflow_edges
-- -----------------------------------------------------------------------------
CREATE TABLE automation_workflow_edges (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id      uuid NOT NULL REFERENCES automation_workflow_versions(id) ON DELETE CASCADE,
    edge_id         text NOT NULL,
    source_node_id  text NOT NULL,
    source_port     text,
    target_node_id  text NOT NULL,
    target_port     text,
    UNIQUE (version_id, edge_id)
);

-- -----------------------------------------------------------------------------
-- automation_triggers
-- -----------------------------------------------------------------------------
CREATE TABLE automation_triggers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     uuid NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
    version_id      uuid NOT NULL REFERENCES automation_workflow_versions(id) ON DELETE CASCADE,
    trigger_type    text NOT NULL,
    config          jsonb NOT NULL DEFAULT '{}'::jsonb,
    enabled         boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX automation_triggers_workflow_idx ON automation_triggers (workflow_id) WHERE enabled = true;

-- -----------------------------------------------------------------------------
-- automation_schedules
-- -----------------------------------------------------------------------------
CREATE TABLE automation_schedules (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     uuid NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
    version_id      uuid NOT NULL REFERENCES automation_workflow_versions(id) ON DELETE CASCADE,
    schedule_type   text NOT NULL,
    cron_expression text,
    timezone        text NOT NULL DEFAULT 'UTC',
    next_run_at     timestamptz,
    last_run_at     timestamptz,
    enabled         boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT automation_schedules_type_check CHECK (schedule_type IN (
        'one_time', 'recurring', 'daily', 'weekly', 'calendar'
    ))
);

CREATE INDEX automation_schedules_next_run_idx ON automation_schedules (next_run_at) WHERE enabled = true;

-- -----------------------------------------------------------------------------
-- automation_templates
-- -----------------------------------------------------------------------------
CREATE TABLE automation_templates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    description     text,
    definition      jsonb NOT NULL,
    version         integer NOT NULL DEFAULT 1,
    status          text NOT NULL DEFAULT 'active',
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- automation_workflow_runs
-- -----------------------------------------------------------------------------
CREATE TABLE automation_workflow_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     uuid NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
    version_id      uuid NOT NULL REFERENCES automation_workflow_versions(id) ON DELETE RESTRICT,
    version         integer NOT NULL,
    trigger_event_id uuid,
    state           text NOT NULL DEFAULT 'queued',
    correlation_id  uuid,
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    error_message   text,
    CONSTRAINT automation_workflow_runs_state_check CHECK (state IN (
        'queued', 'running', 'waiting', 'awaiting_approval', 'succeeded',
        'partially_succeeded', 'failed', 'canceled', 'timed_out',
        'paused', 'reconciliation_required'
    ))
);

CREATE INDEX automation_workflow_runs_workflow_idx ON automation_workflow_runs (workflow_id, started_at DESC);

-- -----------------------------------------------------------------------------
-- automation_workflow_run_steps
-- -----------------------------------------------------------------------------
CREATE TABLE automation_workflow_run_steps (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES automation_workflow_runs(id) ON DELETE CASCADE,
    node_id         text NOT NULL,
    node_type       text NOT NULL,
    step_index      integer NOT NULL,
    state           text NOT NULL,
    input           jsonb,
    output          jsonb,
    error_message   text,
    duration_ms     integer,
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz
);

CREATE INDEX automation_workflow_run_steps_run_idx ON automation_workflow_run_steps (run_id, step_index);

-- -----------------------------------------------------------------------------
-- automation_action_attempts
-- -----------------------------------------------------------------------------
CREATE TABLE automation_action_attempts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_step_id     uuid NOT NULL REFERENCES automation_workflow_run_steps(id) ON DELETE CASCADE,
    attempt_number  integer NOT NULL,
    request_payload jsonb,
    response_payload jsonb,
    error_class     text,
    error_message   text,
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    UNIQUE (run_step_id, attempt_number)
);

-- -----------------------------------------------------------------------------
-- automation_test_runs
-- -----------------------------------------------------------------------------
CREATE TABLE automation_test_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     uuid NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
    version_id      uuid NOT NULL REFERENCES automation_workflow_versions(id) ON DELETE RESTRICT,
    input_sample    jsonb,
    result          text NOT NULL,
    steps_executed  jsonb,
    validation_errors jsonb,
    duration_ms     integer,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT automation_test_runs_result_check CHECK (result IN ('passed', 'failed', 'partial'))
);

-- -----------------------------------------------------------------------------
-- automation_usage_events
-- -----------------------------------------------------------------------------
CREATE TABLE automation_usage_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    workflow_id     uuid REFERENCES automation_workflows(id) ON DELETE SET NULL,
    run_id          uuid REFERENCES automation_workflow_runs(id) ON DELETE SET NULL,
    event_type      text NOT NULL,
    quantity        integer NOT NULL DEFAULT 1,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX automation_usage_events_workspace_idx ON automation_usage_events (workspace_id, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- automation_audit_events
-- -----------------------------------------------------------------------------
CREATE TABLE automation_audit_events (
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