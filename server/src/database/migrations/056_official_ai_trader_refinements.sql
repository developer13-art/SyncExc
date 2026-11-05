-- =============================================================================
-- 056_official_ai_trader_refinements.sql
-- Additive columns required by the official trader approval and reconciliation
-- workflows.
-- =============================================================================

ALTER TABLE official_trader_analyses
    ADD COLUMN IF NOT EXISTS order_type text
    CHECK (order_type IS NULL OR order_type IN ('market', 'limit'));

ALTER TABLE official_trader_executions
    ADD COLUMN IF NOT EXISTS execution_request_id uuid;

ALTER TABLE official_trader_closures
    ADD COLUMN IF NOT EXISTS attribution_evidence jsonb;
