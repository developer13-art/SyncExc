ALTER TABLE trading_fills
    ADD COLUMN entry_price numeric(30, 12),
    ADD COLUMN realized_pnl numeric(30, 12);

CREATE TABLE trading_spot_lots (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    connection_id         uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    account_id            uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
    instrument            text NOT NULL,
    fill_id               uuid NOT NULL UNIQUE REFERENCES trading_fills(id) ON DELETE CASCADE,
    acquired_at           timestamptz NOT NULL,
    original_quantity     numeric(30, 12) NOT NULL,
    remaining_quantity    numeric(30, 12) NOT NULL,
    cost_basis_per_unit   numeric(30, 12) NOT NULL,
    cost_basis_known      boolean NOT NULL DEFAULT true,
    created_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trading_spot_lots_positive_quantity CHECK (
        original_quantity > 0 AND remaining_quantity >= 0 AND remaining_quantity <= original_quantity
    )
);

CREATE INDEX trading_spot_lots_fifo_idx
    ON trading_spot_lots (account_id, instrument, acquired_at, id)
    WHERE remaining_quantity > 0;
