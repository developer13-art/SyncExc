ALTER TABLE marketplace_published_signals
    ADD COLUMN source_position_snapshot_id uuid UNIQUE
        REFERENCES trading_position_snapshots(id) ON DELETE SET NULL;
