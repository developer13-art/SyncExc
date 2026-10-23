ALTER TABLE marketplace_performance_observations
    ADD COLUMN source_closed_trade_id uuid REFERENCES trading_closed_trades(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX marketplace_performance_observations_closed_trade_unique
    ON marketplace_performance_observations (source_closed_trade_id)
    WHERE source_closed_trade_id IS NOT NULL;
