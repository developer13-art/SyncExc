ALTER TABLE marketplace_published_signals
    ADD COLUMN order_type text NOT NULL DEFAULT 'market',
    ADD COLUMN entry_time timestamptz NOT NULL DEFAULT now(),
    ADD CONSTRAINT marketplace_published_signals_order_type_check
        CHECK (order_type IN ('market', 'limit'));

ALTER TABLE marketplace_published_signals
    ADD COLUMN source_order_id uuid UNIQUE REFERENCES trading_orders(id) ON DELETE SET NULL;

ALTER TABLE marketplace_provider_profiles
    ADD COLUMN auto_publish_trades boolean NOT NULL DEFAULT false;
