-- =============================================================================
-- 012_simulation.sql
-- Module 12 — Simulation, Backtesting and Replay
-- =============================================================================

-- -----------------------------------------------------------------------------
-- simulation_environments
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_environments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name            text NOT NULL,
    type            text NOT NULL,
    state           text NOT NULL DEFAULT 'draft',
    settings        jsonb NOT NULL DEFAULT '{}'::jsonb,
    current_version integer NOT NULL DEFAULT 1,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    archived_at     timestamptz,
    CONSTRAINT simulation_environments_type_check CHECK (type IN (
        'paper_trading', 'historical_backtest', 'market_replay',
        'workflow_test', 'synchronization_test', 'scenario_test'
    )),
    CONSTRAINT simulation_environments_state_check CHECK (state IN (
        'draft', 'ready', 'running', 'paused', 'completed', 'failed', 'canceled', 'archived'
    ))
);

CREATE TRIGGER simulation_environments_set_updated_at
    BEFORE UPDATE ON simulation_environments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- simulation_environment_versions
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_environment_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id  uuid NOT NULL REFERENCES simulation_environments(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    config          jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (environment_id, version)
);

-- -----------------------------------------------------------------------------
-- simulation_accounts
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_accounts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id  uuid NOT NULL REFERENCES simulation_environments(id) ON DELETE CASCADE,
    label           text NOT NULL,
    exchange_code   text,
    account_type    text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- simulation_account_balances
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_account_balances (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES simulation_accounts(id) ON DELETE CASCADE,
    asset           text NOT NULL,
    free            numeric(30, 12) NOT NULL DEFAULT 0,
    used            numeric(30, 12) NOT NULL DEFAULT 0,
    total           numeric(30, 12) NOT NULL DEFAULT 0,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (account_id, asset)
);

-- -----------------------------------------------------------------------------
-- simulation_ledger_entries
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_ledger_entries (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES simulation_accounts(id) ON DELETE CASCADE,
    asset           text NOT NULL,
    amount          numeric(30, 12) NOT NULL,
    entry_type      text NOT NULL,
    source_type     text,
    source_id       uuid,
    metadata        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX simulation_ledger_entries_account_idx ON simulation_ledger_entries (account_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- simulation_datasets
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_datasets (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    description     text,
    source          text NOT NULL,
    instrument      text,
    market_type     text,
    coverage_start  timestamptz,
    coverage_end    timestamptz,
    manifest        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- simulation_dataset_versions
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_dataset_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id      uuid NOT NULL REFERENCES simulation_datasets(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    manifest        jsonb NOT NULL,
    checksum        text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (dataset_id, version)
);

-- -----------------------------------------------------------------------------
-- simulation_market_events
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_market_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_version_id uuid NOT NULL REFERENCES simulation_dataset_versions(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    instrument      text NOT NULL,
    payload         jsonb NOT NULL,
    occurred_at     timestamptz NOT NULL
);

CREATE INDEX simulation_market_events_dataset_idx ON simulation_market_events (dataset_version_id, occurred_at);

-- -----------------------------------------------------------------------------
-- simulation_runs
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id  uuid NOT NULL REFERENCES simulation_environments(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    state           text NOT NULL DEFAULT 'queued',
    config          jsonb NOT NULL,
    random_seed     integer,
    engine_version  text NOT NULL,
    metrics         jsonb,
    warnings        jsonb,
    started_at      timestamptz,
    completed_at    timestamptz,
    error_message   text,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT simulation_runs_state_check CHECK (state IN (
        'queued', 'validating', 'preparing_data', 'running', 'paused',
        'completed', 'completed_with_warnings', 'failed', 'canceled', 'timed_out'
    ))
);

CREATE INDEX simulation_runs_environment_idx ON simulation_runs (environment_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- simulation_run_inputs
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_run_inputs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    dataset_version_id uuid REFERENCES simulation_dataset_versions(id) ON DELETE SET NULL,
    workflow_version_id uuid,
    config_snapshot jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- simulation_run_steps
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_run_steps (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    step_index      integer NOT NULL,
    event_type      text,
    state           text NOT NULL,
    input           jsonb,
    output          jsonb,
    duration_ms     integer,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX simulation_run_steps_run_idx ON simulation_run_steps (run_id, step_index);

-- -----------------------------------------------------------------------------
-- simulation_replay_sessions
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_replay_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    position        integer NOT NULL DEFAULT 0,
    speed           numeric(5, 2) NOT NULL DEFAULT 1,
    state           text NOT NULL DEFAULT 'stopped',
    checkpoints     jsonb,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- simulation_orders
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_orders (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES simulation_accounts(id) ON DELETE CASCADE,
    instrument      text NOT NULL,
    market_type     text NOT NULL,
    side            text NOT NULL,
    type            text NOT NULL,
    quantity        numeric(30, 12) NOT NULL,
    price           numeric(30, 12),
    filled_quantity numeric(30, 12) NOT NULL DEFAULT 0,
    average_fill_price numeric(30, 12),
    status          text NOT NULL DEFAULT 'created',
    metadata        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT simulation_orders_side_check CHECK (side IN ('buy', 'sell'))
);

CREATE INDEX simulation_orders_run_idx ON simulation_orders (run_id, created_at);

-- -----------------------------------------------------------------------------
-- simulation_order_events
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_order_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        uuid NOT NULL REFERENCES simulation_orders(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    payload         jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- simulation_fills
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_fills (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        uuid NOT NULL REFERENCES simulation_orders(id) ON DELETE CASCADE,
    quantity        numeric(30, 12) NOT NULL,
    price           numeric(30, 12) NOT NULL,
    fee             numeric(30, 12),
    fee_asset       text,
    fill_model      text NOT NULL,
    executed_at     timestamptz NOT NULL
);

-- -----------------------------------------------------------------------------
-- simulation_positions
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_positions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES simulation_accounts(id) ON DELETE CASCADE,
    instrument      text NOT NULL,
    side            text NOT NULL,
    quantity        numeric(30, 12) NOT NULL,
    entry_price     numeric(30, 12) NOT NULL,
    mark_price      numeric(30, 12),
    unrealized_pnl  numeric(30, 12),
    realized_pnl    numeric(30, 12),
    leverage        numeric(20, 6),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT simulation_positions_side_check CHECK (side IN ('long', 'short'))
);

CREATE UNIQUE INDEX simulation_positions_unique ON simulation_positions (run_id, account_id, instrument, side);

-- -----------------------------------------------------------------------------
-- simulation_position_snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_position_snapshots (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id     uuid NOT NULL REFERENCES simulation_positions(id) ON DELETE CASCADE,
    snapshot        jsonb NOT NULL,
    observed_at     timestamptz NOT NULL
);

-- -----------------------------------------------------------------------------
-- simulation_cost_events
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_cost_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    account_id      uuid NOT NULL REFERENCES simulation_accounts(id) ON DELETE CASCADE,
    cost_type       text NOT NULL,
    amount          numeric(30, 12) NOT NULL,
    asset           text NOT NULL,
    source          text,
    occurred_at     timestamptz NOT NULL
);

-- -----------------------------------------------------------------------------
-- simulation_risk_evaluations
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_risk_evaluations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    evaluation      jsonb NOT NULL,
    occurred_at     timestamptz NOT NULL
);

-- -----------------------------------------------------------------------------
-- simulation_sync_jobs
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_sync_jobs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    source_event    jsonb NOT NULL,
    destinations    jsonb NOT NULL DEFAULT '[]'::jsonb,
    status          text NOT NULL DEFAULT 'pending',
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- simulation_destination_results
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_destination_results (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          uuid NOT NULL REFERENCES simulation_sync_jobs(id) ON DELETE CASCADE,
    destination_ref text NOT NULL,
    outcome         text NOT NULL,
    details         jsonb
);

-- -----------------------------------------------------------------------------
-- simulation_scenarios
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_scenarios (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    name            text NOT NULL,
    description     text,
    current_version integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER simulation_scenarios_set_updated_at BEFORE UPDATE ON simulation_scenarios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- simulation_scenario_versions
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_scenario_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id     uuid NOT NULL REFERENCES simulation_scenarios(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    parameters      jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (scenario_id, version)
);

-- -----------------------------------------------------------------------------
-- simulation_test_fixtures
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_test_fixtures (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id     uuid REFERENCES simulation_scenarios(id) ON DELETE CASCADE,
    name            text NOT NULL,
    input           jsonb NOT NULL,
    expected_output jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- simulation_metrics
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_metrics (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    metric_name     text NOT NULL,
    metric_value    numeric(30, 12),
    metric_metadata jsonb,
    UNIQUE (run_id, metric_name)
);

-- -----------------------------------------------------------------------------
-- simulation_reports
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_reports (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    version         integer NOT NULL DEFAULT 1,
    storage_key     text,
    status          text NOT NULL DEFAULT 'pending',
    generated_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT simulation_reports_status_check CHECK (status IN ('pending', 'generating', 'ready', 'failed'))
);

-- -----------------------------------------------------------------------------
-- simulation_comparisons
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_comparisons (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    baseline_run_id uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    comparison_run_id uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    differences     jsonb,
    warnings        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- simulation_resource_usage
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_resource_usage (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    run_id          uuid REFERENCES simulation_runs(id) ON DELETE SET NULL,
    metric          text NOT NULL,
    value           bigint NOT NULL,
    recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX simulation_resource_usage_workspace_idx ON simulation_resource_usage (workspace_id, recorded_at DESC);

-- -----------------------------------------------------------------------------
-- simulation_audit_events
-- -----------------------------------------------------------------------------
CREATE TABLE simulation_audit_events (
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