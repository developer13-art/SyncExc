ALTER TABLE marketplace_published_signals
    ADD COLUMN source_account_id uuid REFERENCES exchange_accounts(id) ON DELETE SET NULL,
    ADD COLUMN realized_pnl numeric(30, 12),
    ADD COLUMN pnl_asset text,
    ADD COLUMN closed_at timestamptz,
    ADD COLUMN source_closed_trade_id uuid REFERENCES trading_closed_trades(id) ON DELETE SET NULL;

UPDATE marketplace_published_signals signal
SET source_account_id = source_order.account_id
FROM trading_orders source_order
WHERE signal.source_order_id = source_order.id
  AND signal.source_account_id IS NULL;

UPDATE marketplace_published_signals signal
SET source_account_id = source_position.account_id
FROM trading_position_snapshots snapshot
JOIN trading_positions source_position ON source_position.id = snapshot.position_id
WHERE signal.source_position_snapshot_id = snapshot.id
  AND signal.source_account_id IS NULL;

CREATE INDEX marketplace_published_signals_source_account_idx
    ON marketplace_published_signals (source_account_id, instrument, status)
    WHERE source_account_id IS NOT NULL;

CREATE UNIQUE INDEX marketplace_published_signals_source_closed_trade_unique
    ON marketplace_published_signals (source_closed_trade_id);
