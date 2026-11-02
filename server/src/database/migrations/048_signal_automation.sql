ALTER TABLE trading_signal_candidates
  ALTER COLUMN instrument DROP NOT NULL,
  ALTER COLUMN direction DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS order_type text;

ALTER TABLE trading_signal_candidates
  DROP CONSTRAINT IF EXISTS trading_signal_candidates_order_type_check,
  ADD CONSTRAINT trading_signal_candidates_order_type_check
    CHECK (order_type IS NULL OR order_type IN ('market', 'limit'));

ALTER TABLE signal_source_execution_configs
  DROP CONSTRAINT IF EXISTS signal_source_execution_configs_mode_check,
  ADD CONSTRAINT signal_source_execution_configs_mode_check
    CHECK (mode IN ('monitor_only', 'review', 'simulate', 'live', 'authorized_automation'));
