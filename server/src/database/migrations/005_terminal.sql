-- =============================================================================
-- 005_terminal.sql
-- Module 05 — Unified Trading Terminal
-- =============================================================================

-- -----------------------------------------------------------------------------
-- trading_orders
-- -----------------------------------------------------------------------------
CREATE TABLE trading_orders (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    connection_id         uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE RESTRICT,
    account_id            uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE RESTRICT,
    exchange_order_id     text,
    client_order_id       text,
    instrument            text NOT NULL,
    market_type           text NOT NULL,
    side                  text NOT NULL,
    type                  text NOT NULL,
    quantity              numeric(30, 12) NOT NULL,
    filled_quantity       numeric(30, 12) NOT NULL DEFAULT 0,
    remaining_quantity    numeric(30, 12),
    price                 numeric(30, 12),
    average_fill_price    numeric(30, 12),
    trigger_price         numeric(30, 12),
    time_in_force         text,
    reduce_only           boolean NOT NULL DEFAULT false,
    status                text NOT NULL DEFAULT 'pending_submission',
    rejection_reason      text,
    source                text NOT NULL DEFAULT 'terminal',
    related_execution_id  uuid,
    related_sync_id       uuid,
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trading_orders_side_check CHECK (side IN ('buy', 'sell')),
    CONSTRAINT trading_orders_type_check CHECK (type IN (
        'market', 'limit', 'stop_market', 'stop_limit', 'take_profit_market', 'take_profit_limit', 'trailing_stop'
    )),
    CONSTRAINT trading_orders_status_check CHECK (status IN (
        'pending_submission', 'submitted', 'acknowledged', 'partially_filled', 'filled',
        'cancel_requested', 'canceled', 'rejected', 'expired', 'unknown', 'reconciliation_required'
    ))
);

CREATE INDEX trading_orders_workspace_idx ON trading_orders (workspace_id, created_at DESC);
CREATE INDEX trading_orders_account_idx ON trading_orders (account_id, created_at DESC);
CREATE INDEX trading_orders_status_idx ON trading_orders (status) WHERE status NOT IN ('filled', 'canceled', 'rejected', 'expired');
CREATE INDEX trading_orders_exchange_id_idx ON trading_orders (exchange_order_id) WHERE exchange_order_id IS NOT NULL;

CREATE TRIGGER trading_orders_set_updated_at BEFORE UPDATE ON trading_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- trading_order_events
-- -----------------------------------------------------------------------------
CREATE TABLE trading_order_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        uuid NOT NULL REFERENCES trading_orders(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    previous_status text,
    new_status      text,
    payload         jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trading_order_events_order_idx ON trading_order_events (order_id, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- trading_fills
-- -----------------------------------------------------------------------------
CREATE TABLE trading_fills (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id              uuid NOT NULL REFERENCES trading_orders(id) ON DELETE CASCADE,
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    exchange_trade_id     text,
    instrument            text NOT NULL,
    side                  text NOT NULL,
    quantity              numeric(30, 12) NOT NULL,
    price                 numeric(30, 12) NOT NULL,
    fee_amount            numeric(30, 12),
    fee_asset             text,
    executed_at           timestamptz NOT NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trading_fills_side_check CHECK (side IN ('buy', 'sell'))
);

CREATE UNIQUE INDEX trading_fills_exchange_trade_unique
    ON trading_fills (order_id, exchange_trade_id)
    WHERE exchange_trade_id IS NOT NULL;
CREATE INDEX trading_fills_order_idx ON trading_fills (order_id, executed_at DESC);
CREATE INDEX trading_fills_workspace_idx ON trading_fills (workspace_id, executed_at DESC);

-- -----------------------------------------------------------------------------
-- trading_positions (current state)
-- -----------------------------------------------------------------------------
CREATE TABLE trading_positions (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    connection_id         uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    account_id            uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
    instrument            text NOT NULL,
    side                  text NOT NULL,
    quantity              numeric(30, 12) NOT NULL,
    entry_price           numeric(30, 12) NOT NULL,
    mark_price            numeric(30, 12),
    unrealized_pnl        numeric(30, 12),
    realized_pnl          numeric(30, 12),
    margin_mode           text,
    leverage              numeric(20, 6),
    liquidation_price     numeric(30, 12),
    position_mode         text,
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trading_positions_side_check CHECK (side IN ('long', 'short', 'both'))
);

CREATE UNIQUE INDEX trading_positions_unique ON trading_positions (account_id, instrument, side);
CREATE INDEX trading_positions_workspace_idx ON trading_positions (workspace_id);

CREATE TRIGGER trading_positions_set_updated_at BEFORE UPDATE ON trading_positions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- trading_position_snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE trading_position_snapshots (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id     uuid NOT NULL REFERENCES trading_positions(id) ON DELETE CASCADE,
    quantity        numeric(30, 12) NOT NULL,
    entry_price     numeric(30, 12) NOT NULL,
    mark_price      numeric(30, 12),
    unrealized_pnl  numeric(30, 12),
    observed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trading_position_snapshots_position_idx ON trading_position_snapshots (position_id, observed_at DESC);

-- -----------------------------------------------------------------------------
-- trading_execution_requests
-- -----------------------------------------------------------------------------
CREATE TABLE trading_execution_requests (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    connection_id         uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE RESTRICT,
    account_id            uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE RESTRICT,
    operation_type        text NOT NULL,
    state                 text NOT NULL DEFAULT 'pending',
    payload               jsonb NOT NULL,
    risk_evaluation_id    uuid,
    idempotency_key       text NOT NULL,
    correlation_id        uuid,
    created_by            uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    completed_at          timestamptz,
    CONSTRAINT trading_execution_requests_state_check CHECK (state IN (
        'pending', 'validating', 'awaiting_confirmation', 'submitting', 'acknowledged',
        'partially_executed', 'completed', 'rejected', 'canceled', 'failed', 'reconciliation_required'
    ))
);

CREATE UNIQUE INDEX trading_execution_requests_idem_unique ON trading_execution_requests (idempotency_key);
CREATE INDEX trading_execution_requests_workspace_idx ON trading_execution_requests (workspace_id, created_at DESC);

CREATE TRIGGER trading_execution_requests_set_updated_at BEFORE UPDATE ON trading_execution_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- trading_execution_attempts
-- -----------------------------------------------------------------------------
CREATE TABLE trading_execution_attempts (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_request_id  uuid NOT NULL REFERENCES trading_execution_requests(id) ON DELETE CASCADE,
    attempt_number        integer NOT NULL,
    request_payload       jsonb NOT NULL,
    response_status       text,
    response_payload      jsonb,
    error_message         text,
    started_at            timestamptz NOT NULL DEFAULT now(),
    completed_at          timestamptz,
    UNIQUE (execution_request_id, attempt_number)
);

-- -----------------------------------------------------------------------------
-- trading_reconciliation_events
-- -----------------------------------------------------------------------------
CREATE TABLE trading_reconciliation_events (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    execution_request_id  uuid REFERENCES trading_execution_requests(id) ON DELETE SET NULL,
    order_id              uuid REFERENCES trading_orders(id) ON DELETE SET NULL,
    category              text NOT NULL,
    discrepancy           jsonb NOT NULL,
    resolution            jsonb,
    resolved_at           timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- terminal_preferences
-- -----------------------------------------------------------------------------
CREATE TABLE terminal_preferences (
    user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_currency text NOT NULL DEFAULT 'USD',
    default_market   text NOT NULL DEFAULT 'spot',
    layout           jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER terminal_preferences_set_updated_at BEFORE UPDATE ON terminal_preferences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- terminal_saved_views
-- -----------------------------------------------------------------------------
CREATE TABLE terminal_saved_views (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    name            text NOT NULL,
    view_type       text NOT NULL,
    config          jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX terminal_saved_views_user_idx ON terminal_saved_views (user_id, workspace_id);

-- -----------------------------------------------------------------------------
-- terminal_notifications
-- -----------------------------------------------------------------------------
CREATE TABLE terminal_notifications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
    category        text NOT NULL,
    severity        text NOT NULL,
    title           text NOT NULL,
    message         text,
    resource_type   text,
    resource_id     uuid,
    read_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT terminal_notifications_severity_check CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

CREATE INDEX terminal_notifications_user_idx ON terminal_notifications (user_id, created_at DESC) WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- terminal_export_jobs
-- -----------------------------------------------------------------------------
CREATE TABLE terminal_export_jobs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    export_type     text NOT NULL,
    filters         jsonb,
    status          text NOT NULL DEFAULT 'pending',
    file_key        text,
    file_size       bigint,
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    CONSTRAINT terminal_export_jobs_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX terminal_export_jobs_user_idx ON terminal_export_jobs (user_id, created_at DESC);