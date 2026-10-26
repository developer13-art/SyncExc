ALTER TABLE trading_orders
    DROP CONSTRAINT trading_orders_status_check;

ALTER TABLE trading_orders
    ADD CONSTRAINT trading_orders_status_check CHECK (status IN (
        'pending_submission', 'submitted', 'acknowledged', 'partially_filled', 'filled',
        'cancel_requested', 'canceled', 'rejected', 'failed', 'expired', 'unknown',
        'reconciliation_required'
    ));

DROP INDEX IF EXISTS trading_orders_status_idx;
CREATE INDEX trading_orders_status_idx
    ON trading_orders (status)
    WHERE status NOT IN ('filled', 'canceled', 'rejected', 'failed', 'expired');
