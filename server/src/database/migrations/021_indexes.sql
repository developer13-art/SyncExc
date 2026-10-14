-- =============================================================================
-- 021_indexes.sql
-- Additional indexes and helper functions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Partial indexes for common queries
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS trading_orders_open_idx
    ON trading_orders (workspace_id, updated_at DESC)
    WHERE status IN ('submitted', 'acknowledged', 'partially_filled', 'cancel_requested');

CREATE INDEX IF NOT EXISTS sync_destination_operations_pending_idx
    ON sync_destination_operations (updated_at)
    WHERE status IN ('pending', 'dispatched', 'outcome_unknown', 'reconciliation_required');

CREATE INDEX IF NOT EXISTS risk_evaluations_recent_idx
    ON risk_evaluations (workspace_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_recent_idx
    ON notifications (user_id, created_at DESC)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS support_tickets_open_idx
    ON support_tickets (created_at DESC)
    WHERE status NOT IN ('closed', 'canceled');

CREATE INDEX IF NOT EXISTS dev_webhooks_pending_idx
    ON developer_webhook_deliveries (next_retry_at)
    WHERE state IN ('pending', 'retry_scheduled');

-- -----------------------------------------------------------------------------
-- Text search indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS community_posts_content_fts_idx
    ON community_posts USING GIN (to_tsvector('english', content))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS support_articles_content_fts_idx
    ON support_article_versions USING GIN (to_tsvector('english', content));

-- -----------------------------------------------------------------------------
-- Helper: touch_row. Same as set_updated_at but generic.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_row()
RETURNS trigger AS $$
BEGIN
    IF (TG_TABLE_NAME) IS NOT NULL THEN
        IF (SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = TG_TABLE_SCHEMA
              AND table_name = TG_TABLE_NAME
              AND column_name = 'updated_at'
        )) THEN
            NEW.updated_at = now();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Helper: current_timestamp_utc
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION now_utc()
RETURNS timestamptz AS $$
BEGIN
    RETURN now() AT TIME ZONE 'UTC';
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Helper: safe JSONB merge
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jsonb_shallow_merge(a jsonb, b jsonb)
RETURNS jsonb AS $$
BEGIN
    RETURN a || b;
END;
$$ LANGUAGE plpgsql IMMUTABLE;