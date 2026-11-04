-- =============================================================================
-- 054_admin_console_operations.sql
-- Payout settlement pipeline, featured/pinned content, scheduled publishing
-- =============================================================================

-- Payout requests now follow an explicitly reviewable settlement lifecycle.
ALTER TABLE marketplace_trader_payout_requests
    DROP CONSTRAINT IF EXISTS marketplace_trader_payout_requests_status_check;

ALTER TABLE marketplace_trader_payout_requests
    ADD CONSTRAINT marketplace_trader_payout_requests_status_check
    CHECK (status IN (
        'pending', 'under_review', 'approved', 'processing',
        'paid', 'failed', 'rejected', 'reversed'
    ));

ALTER TABLE marketplace_trader_payout_requests
    ADD COLUMN IF NOT EXISTS provider_status text,
    ADD COLUMN IF NOT EXISTS settlement_evidence jsonb,
    ADD COLUMN IF NOT EXISTS settled_at timestamptz;

CREATE INDEX IF NOT EXISTS marketplace_trader_payout_requests_status_idx
    ON marketplace_trader_payout_requests (status, created_at DESC);

-- Featured marketplace content
ALTER TABLE marketplace_provider_profiles
    ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS featured_rank integer;

ALTER TABLE marketplace_published_signals
    ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

ALTER TABLE marketplace_strategies
    ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS marketplace_provider_profiles_featured_idx
    ON marketplace_provider_profiles (is_featured, featured_rank)
    WHERE is_featured = true;

-- Community pinned posts
ALTER TABLE community_posts
    ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

CREATE INDEX IF NOT EXISTS community_posts_pinned_idx
    ON community_posts (is_pinned, pinned_at DESC)
    WHERE is_pinned = true;

-- Scheduled content publishing
ALTER TABLE platform_content_pages
    ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;
