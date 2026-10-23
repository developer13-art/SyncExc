ALTER TABLE marketplace_signal_closed_trades
    ADD COLUMN IF NOT EXISTS pnl_asset text;
