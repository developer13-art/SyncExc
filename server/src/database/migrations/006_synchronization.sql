-- =============================================================================
-- 006_synchronization.sql
-- Module 06 — Cross-Exchange Trade Synchronization Engine
-- =============================================================================

-- -----------------------------------------------------------------------------
-- sync_groups
-- -----------------------------------------------------------------------------
CREATE TABLE sync_groups (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id           uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name                   text NOT NULL,
    source_connection_id   uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE RESTRICT,
    source_account_id      uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE RESTRICT,
    market_types           text[] NOT NULL,
    enabled_event_types    text[] NOT NULL,
    mirroring_mode         text NOT NULL DEFAULT 'fill_based',
    execution_mode         text NOT NULL DEFAULT 'confirm_before_execution',
    status                 text NOT NULL DEFAULT 'draft',
    current_version        integer NOT NULL DEFAULT 1,
    created_by             uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sync_groups_mirroring_check CHECK (mirroring_mode IN ('order_intent', 'fill_based', 'lifecycle_sync')),
    CONSTRAINT sync_groups_execution_check CHECK (execution_mode IN (
        'monitor_only', 'confirm_before_execution', 'authorized_automation'
    )),
    CONSTRAINT sync_groups_status_check CHECK (status IN ('draft', 'active', 'paused', 'archived'))
);

CREATE INDEX sync_groups_workspace_idx ON sync_groups (workspace_id, status);

CREATE TRIGGER sync_groups_set_updated_at BEFORE UPDATE ON sync_groups
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- sync_group_versions
-- -----------------------------------------------------------------------------
CREATE TABLE sync_group_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        uuid NOT NULL REFERENCES sync_groups(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    snapshot        jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_id, version)
);

-- -----------------------------------------------------------------------------
-- sync_group_destinations
-- -----------------------------------------------------------------------------
CREATE TABLE sync_group_destinations (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id              uuid NOT NULL REFERENCES sync_groups(id) ON DELETE CASCADE,
    connection_id         uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE RESTRICT,
    account_id            uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE RESTRICT,
    sizing_policy_id      uuid,
    risk_policy_id        uuid,
    status                text NOT NULL DEFAULT 'active',
    enabled_event_types   text[],
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sync_group_destinations_status_check CHECK (status IN ('active', 'paused', 'disabled'))
);

CREATE UNIQUE INDEX sync_group_destinations_unique ON sync_group_destinations (group_id, account_id);

-- -----------------------------------------------------------------------------
-- sync_event_subscriptions
-- -----------------------------------------------------------------------------
CREATE TABLE sync_event_subscriptions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id          uuid NOT NULL REFERENCES sync_groups(id) ON DELETE CASCADE,
    event_type        text NOT NULL,
    filters           jsonb,
    enabled           boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_id, event_type)
);

-- -----------------------------------------------------------------------------
-- sync_instrument_mappings
-- -----------------------------------------------------------------------------
CREATE TABLE sync_instrument_mappings (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id              uuid NOT NULL REFERENCES sync_groups(id) ON DELETE CASCADE,
    source_instrument     text NOT NULL,
    destination_id        uuid NOT NULL REFERENCES sync_group_destinations(id) ON DELETE CASCADE,
    destination_instrument text NOT NULL,
    conversion_factor     numeric(30, 12),
    validated_at          timestamptz,
    validation_metadata   jsonb,
    created_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_id, destination_id, source_instrument)
);

-- -----------------------------------------------------------------------------
-- sync_sizing_policies
-- -----------------------------------------------------------------------------
CREATE TABLE sync_sizing_policies (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        uuid REFERENCES sync_groups(id) ON DELETE CASCADE,
    name            text NOT NULL,
    policy_type     text NOT NULL,
    config          jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sync_sizing_policies_type_check CHECK (policy_type IN (
        'fixed_quantity', 'fixed_quote_value', 'proportional_source_quantity',
        'balance_based_scaling', 'risk_limited_sizing', 'capped_proportional'
    ))
);

ALTER TABLE sync_group_destinations
    ADD CONSTRAINT sync_group_destinations_sizing_fk
    FOREIGN KEY (sizing_policy_id) REFERENCES sync_sizing_policies(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- sync_source_events
-- -----------------------------------------------------------------------------
CREATE TABLE sync_source_events (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id            uuid REFERENCES sync_groups(id) ON DELETE SET NULL,
    source_connection_id uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    source_account_id   uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
    exchange_event_id   text,
    event_type          text NOT NULL,
    instrument          text NOT NULL,
    payload             jsonb NOT NULL,
    occurred_at         timestamptz NOT NULL,
    received_at         timestamptz NOT NULL DEFAULT now(),
    processed_at        timestamptz,
    processing_status   text NOT NULL DEFAULT 'received'
);

CREATE INDEX sync_source_events_group_idx ON sync_source_events (group_id, received_at DESC);
CREATE INDEX sync_source_events_status_idx ON sync_source_events (processing_status) WHERE processed_at IS NULL;
CREATE UNIQUE INDEX sync_source_events_exchange_unique
    ON sync_source_events (source_connection_id, exchange_event_id)
    WHERE exchange_event_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- sync_event_deduplication
-- -----------------------------------------------------------------------------
CREATE TABLE sync_event_deduplication (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dedup_key         text NOT NULL UNIQUE,
    source_event_id   uuid REFERENCES sync_source_events(id) ON DELETE CASCADE,
    scope             text NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sync_event_deduplication_created_idx ON sync_event_deduplication (created_at);

-- -----------------------------------------------------------------------------
-- sync_operations
-- -----------------------------------------------------------------------------
CREATE TABLE sync_operations (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id              uuid NOT NULL REFERENCES sync_groups(id) ON DELETE RESTRICT,
    group_version         integer NOT NULL,
    source_event_id       uuid NOT NULL REFERENCES sync_source_events(id) ON DELETE RESTRICT,
    source_event_type     text NOT NULL,
    source_instrument     text NOT NULL,
    status                text NOT NULL DEFAULT 'queued',
    requested_quantity    numeric(30, 12),
    requested_notional    numeric(30, 12),
    created_at            timestamptz NOT NULL DEFAULT now(),
    completed_at          timestamptz,
    CONSTRAINT sync_operations_status_check CHECK (status IN (
        'queued', 'processing', 'completed', 'completed_with_exceptions',
        'partially_completed', 'failed', 'outcome_unknown', 'paused', 'reconciliation_required'
    ))
);

CREATE INDEX sync_operations_group_idx ON sync_operations (group_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- sync_destination_operations
-- -----------------------------------------------------------------------------
CREATE TABLE sync_destination_operations (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id          uuid NOT NULL REFERENCES sync_operations(id) ON DELETE CASCADE,
    destination_id        uuid NOT NULL REFERENCES sync_group_destinations(id) ON DELETE RESTRICT,
    account_id            uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE RESTRICT,
    status                text NOT NULL DEFAULT 'pending',
    requested_quantity    numeric(30, 12),
    requested_notional    numeric(30, 12),
    filled_quantity       numeric(30, 12) NOT NULL DEFAULT 0,
    destination_order_id  uuid REFERENCES trading_orders(id) ON DELETE SET NULL,
    idempotency_key       text NOT NULL,
    risk_evaluation_id    uuid,
    error_code            text,
    error_message         text,
    attempts              integer NOT NULL DEFAULT 0,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    completed_at          timestamptz,
    CONSTRAINT sync_destination_operations_status_check CHECK (status IN (
        'pending', 'dispatched', 'acknowledged', 'partially_filled', 'filled', 'rejected',
        'timed_out', 'rate_limited', 'disconnected', 'risk_blocked', 'unsupported',
        'outcome_unknown', 'reconciliation_required'
    ))
);

CREATE UNIQUE INDEX sync_destination_operations_idem_unique ON sync_destination_operations (idempotency_key);
CREATE INDEX sync_destination_operations_op_idx ON sync_destination_operations (operation_id);

-- -----------------------------------------------------------------------------
-- sync_operation_attempts
-- -----------------------------------------------------------------------------
CREATE TABLE sync_operation_attempts (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_operation_id uuid NOT NULL REFERENCES sync_destination_operations(id) ON DELETE CASCADE,
    attempt_number        integer NOT NULL,
    request_payload       jsonb NOT NULL,
    response_status       text,
    response_payload      jsonb,
    error_class           text,
    error_message         text,
    started_at            timestamptz NOT NULL DEFAULT now(),
    completed_at          timestamptz,
    UNIQUE (destination_operation_id, attempt_number)
);

-- -----------------------------------------------------------------------------
-- sync_order_links
-- -----------------------------------------------------------------------------
CREATE TABLE sync_order_links (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_operation_id uuid NOT NULL REFERENCES sync_destination_operations(id) ON DELETE CASCADE,
    destination_order_id  uuid REFERENCES trading_orders(id) ON DELETE SET NULL,
    exchange_order_id     text,
    client_order_id       text,
    created_at            timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- sync_fill_allocations
-- -----------------------------------------------------------------------------
CREATE TABLE sync_fill_allocations (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_operation_id uuid NOT NULL REFERENCES sync_destination_operations(id) ON DELETE CASCADE,
    source_fill_id        uuid REFERENCES trading_fills(id) ON DELETE SET NULL,
    destination_fill_id   uuid REFERENCES trading_fills(id) ON DELETE SET NULL,
    allocated_quantity    numeric(30, 12) NOT NULL,
    created_at            timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- sync_operation_events
-- -----------------------------------------------------------------------------
CREATE TABLE sync_operation_events (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id          uuid NOT NULL REFERENCES sync_operations(id) ON DELETE CASCADE,
    destination_id        uuid REFERENCES sync_group_destinations(id) ON DELETE SET NULL,
    event_type            text NOT NULL,
    payload               jsonb,
    occurred_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sync_operation_events_op_idx ON sync_operation_events (operation_id, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- sync_retry_jobs
-- -----------------------------------------------------------------------------
CREATE TABLE sync_retry_jobs (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_operation_id uuid NOT NULL REFERENCES sync_destination_operations(id) ON DELETE CASCADE,
    attempt_number        integer NOT NULL,
    scheduled_at          timestamptz NOT NULL,
    status                text NOT NULL DEFAULT 'pending',
    failure_category      text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sync_retry_jobs_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed', 'canceled'))
);

CREATE INDEX sync_retry_jobs_pending_idx ON sync_retry_jobs (scheduled_at) WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- sync_dead_letter
-- -----------------------------------------------------------------------------
CREATE TABLE sync_dead_letter (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_operation_id uuid REFERENCES sync_destination_operations(id) ON DELETE SET NULL,
    operation_id          uuid REFERENCES sync_operations(id) ON DELETE SET NULL,
    reason                text NOT NULL,
    payload               jsonb NOT NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    resolved_at           timestamptz,
    resolution            jsonb
);

-- -----------------------------------------------------------------------------
-- sync_reconciliation_jobs
-- -----------------------------------------------------------------------------
CREATE TABLE sync_reconciliation_jobs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        uuid REFERENCES sync_groups(id) ON DELETE SET NULL,
    scope           text NOT NULL,
    status          text NOT NULL DEFAULT 'pending',
    started_at      timestamptz,
    completed_at    timestamptz,
    results         jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sync_reconciliation_jobs_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

-- -----------------------------------------------------------------------------
-- sync_reconciliation_discrepancies
-- -----------------------------------------------------------------------------
CREATE TABLE sync_reconciliation_discrepancies (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_job_id uuid NOT NULL REFERENCES sync_reconciliation_jobs(id) ON DELETE CASCADE,
    category              text NOT NULL,
    operation_id          uuid REFERENCES sync_operations(id) ON DELETE SET NULL,
    destination_id        uuid REFERENCES sync_group_destinations(id) ON DELETE SET NULL,
    details               jsonb NOT NULL,
    resolved_at           timestamptz,
    resolution            jsonb
);

-- -----------------------------------------------------------------------------
-- sync_pause_events
-- -----------------------------------------------------------------------------
CREATE TABLE sync_pause_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        uuid REFERENCES sync_groups(id) ON DELETE CASCADE,
    destination_id  uuid REFERENCES sync_group_destinations(id) ON DELETE CASCADE,
    scope           text NOT NULL,
    action          text NOT NULL,
    reason          text,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sync_pause_events_action_check CHECK (action IN ('pause', 'resume'))
);

-- -----------------------------------------------------------------------------
-- sync_concurrency_controls
-- -----------------------------------------------------------------------------
CREATE TABLE sync_concurrency_controls (
    account_id      uuid PRIMARY KEY REFERENCES exchange_accounts(id) ON DELETE CASCADE,
    active_count    integer NOT NULL DEFAULT 0,
    max_concurrent  integer NOT NULL DEFAULT 5,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- sync_metrics (rolling aggregates)
-- -----------------------------------------------------------------------------
CREATE TABLE sync_metrics (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id          uuid REFERENCES sync_groups(id) ON DELETE CASCADE,
    period_start      timestamptz NOT NULL,
    period_end        timestamptz NOT NULL,
    operations_count  integer NOT NULL DEFAULT 0,
    success_count     integer NOT NULL DEFAULT 0,
    partial_count     integer NOT NULL DEFAULT 0,
    failed_count      integer NOT NULL DEFAULT 0,
    avg_latency_ms    integer,
    UNIQUE (group_id, period_start, period_end)
);