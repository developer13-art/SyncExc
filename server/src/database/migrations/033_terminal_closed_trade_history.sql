-- Persist exchange-reported closed derivatives positions and sync progress.
CREATE TABLE trading_closed_trades (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    connection_id         uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    account_id            uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
    exchange_code         text NOT NULL,
    exchange_trade_id     text NOT NULL,
    exchange_order_id     text,
    instrument            text NOT NULL,
    side                  text NOT NULL,
    quantity              numeric(30, 12) NOT NULL,
    entry_price           numeric(30, 12),
    exit_price            numeric(30, 12) NOT NULL,
    realized_pnl          numeric(30, 12) NOT NULL,
    fee_amount            numeric(30, 12),
    fee_asset             text,
    closed_at             timestamptz NOT NULL,
    exchange_payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (account_id, exchange_trade_id)
);

CREATE INDEX trading_closed_trades_workspace_idx
    ON trading_closed_trades (workspace_id, closed_at DESC);

CREATE TABLE trading_exchange_sync_state (
    account_id            uuid PRIMARY KEY REFERENCES exchange_accounts(id) ON DELETE CASCADE,
    closed_pnl_cursor     text,
    closed_pnl_last_at    timestamptz,
    closed_pnl_backfilled boolean NOT NULL DEFAULT false,
    updated_at            timestamptz NOT NULL DEFAULT now()
);
