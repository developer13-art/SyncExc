CREATE TABLE marketplace_trader_signal_executions (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id             uuid NOT NULL REFERENCES marketplace_published_signals(id) ON DELETE CASCADE,
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id         uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    account_id            uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
    execution_request_id  uuid REFERENCES trading_execution_requests(id) ON DELETE SET NULL,
    order_id              uuid REFERENCES trading_orders(id) ON DELETE SET NULL,
    status                text NOT NULL,
    requested_quantity    numeric(30, 12),
    error_message         text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (signal_id, account_id)
);

CREATE INDEX marketplace_trader_signal_executions_order_idx
    ON marketplace_trader_signal_executions (order_id)
    WHERE order_id IS NOT NULL;

CREATE TABLE marketplace_signal_closed_trades (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_execution_id   uuid NOT NULL REFERENCES marketplace_trader_signal_executions(id) ON DELETE CASCADE,
    closed_trade_id       uuid NOT NULL UNIQUE REFERENCES trading_closed_trades(id) ON DELETE CASCADE,
    realized_pnl          numeric(30, 12) NOT NULL,
    pnl_asset             text,
    closed_at             timestamptz NOT NULL,
    created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketplace_signal_closed_trades_execution_idx
    ON marketplace_signal_closed_trades (signal_execution_id, closed_at DESC);
