-- =============================================================================
-- 053_admin_command_centre.sql
-- Platform administration, creator economy, finance, content, and operations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Platform settings (versioned, auditable key/value configuration)
-- -----------------------------------------------------------------------------
CREATE TABLE platform_settings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key             text NOT NULL UNIQUE,
    category        text NOT NULL,
    value           jsonb NOT NULL,
    description     text,
    is_sensitive    boolean NOT NULL DEFAULT false,
    version         integer NOT NULL DEFAULT 1,
    updated_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_settings_category_idx ON platform_settings (category);

CREATE TRIGGER platform_settings_set_updated_at BEFORE UPDATE ON platform_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE platform_setting_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key     text NOT NULL,
    version         integer NOT NULL,
    value           jsonb NOT NULL,
    changed_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    reason          text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (setting_key, version)
);

-- -----------------------------------------------------------------------------
-- Policy, legal, help-centre and release content
-- -----------------------------------------------------------------------------
CREATE TABLE platform_content_pages (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                text NOT NULL UNIQUE,
    content_type        text NOT NULL,
    title               text NOT NULL,
    summary             text,
    body                text NOT NULL,
    locale              text NOT NULL DEFAULT 'en',
    status              text NOT NULL DEFAULT 'draft',
    version             integer NOT NULL DEFAULT 1,
    requires_acceptance boolean NOT NULL DEFAULT false,
    published_at        timestamptz,
    published_by        uuid REFERENCES users(id) ON DELETE SET NULL,
    created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    archived_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT platform_content_pages_status_check CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
    CONSTRAINT platform_content_pages_type_check CHECK (content_type IN (
        'terms', 'privacy', 'risk_disclosure', 'trading_disclaimer', 'subscription_terms',
        'referral_terms', 'community_guidelines', 'help_article', 'faq', 'product_update',
        'release_note', 'maintenance_notice'
    ))
);

CREATE INDEX platform_content_pages_type_idx ON platform_content_pages (content_type, status);

CREATE TRIGGER platform_content_pages_set_updated_at BEFORE UPDATE ON platform_content_pages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE platform_content_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         uuid NOT NULL REFERENCES platform_content_pages(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    title           text NOT NULL,
    body            text NOT NULL,
    status          text NOT NULL,
    changed_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    change_reason   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (page_id, version)
);

CREATE TABLE platform_content_acceptances (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         uuid NOT NULL REFERENCES platform_content_pages(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    accepted_at     timestamptz NOT NULL DEFAULT now(),
    ip_address      text,
    user_agent      text,
    UNIQUE (page_id, version, user_id)
);

-- -----------------------------------------------------------------------------
-- Creator monetization eligibility
-- -----------------------------------------------------------------------------
CREATE TABLE creator_monetization_profiles (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id             uuid NOT NULL UNIQUE REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    state                   text NOT NULL DEFAULT 'pending',
    monetization_enabled    boolean NOT NULL DEFAULT false,
    can_accept_subscribers  boolean NOT NULL DEFAULT true,
    commission_rate_bps     integer,
    max_plans               integer,
    reason                  text,
    reviewed_by             uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at             timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT creator_monetization_state_check CHECK (state IN (
        'pending', 'approved', 'restricted', 'suspended', 'rejected'
    )),
    CONSTRAINT creator_monetization_commission_check CHECK (
        commission_rate_bps IS NULL OR (commission_rate_bps >= 0 AND commission_rate_bps <= 10000)
    )
);

CREATE INDEX creator_monetization_state_idx ON creator_monetization_profiles (state);

CREATE TRIGGER creator_monetization_profiles_set_updated_at BEFORE UPDATE ON creator_monetization_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Platform commission rules (versioned)
-- -----------------------------------------------------------------------------
CREATE TABLE platform_commission_rules (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type        text NOT NULL,
    rate_bps            integer NOT NULL,
    applies_to_existing boolean NOT NULL DEFAULT false,
    status              text NOT NULL DEFAULT 'active',
    effective_from      timestamptz NOT NULL DEFAULT now(),
    effective_to        timestamptz,
    version             integer NOT NULL DEFAULT 1,
    notes               text,
    created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT platform_commission_product_check CHECK (product_type IN (
        'trader_subscription', 'premium_signal', 'premium_strategy',
        'copy_trading_service', 'marketplace_service', 'referral'
    )),
    CONSTRAINT platform_commission_rate_check CHECK (rate_bps >= 0 AND rate_bps <= 10000),
    CONSTRAINT platform_commission_status_check CHECK (status IN ('draft', 'active', 'archived'))
);

CREATE INDEX platform_commission_rules_product_idx ON platform_commission_rules (product_type, status);

CREATE TRIGGER platform_commission_rules_set_updated_at BEFORE UPDATE ON platform_commission_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Promotions, discount codes and campaigns
-- -----------------------------------------------------------------------------
CREATE TABLE monetization_campaigns (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    campaign_type       text NOT NULL DEFAULT 'platform',
    provider_id         uuid REFERENCES marketplace_provider_profiles(id) ON DELETE SET NULL,
    description         text,
    discount_type       text NOT NULL,
    discount_value      numeric(20, 4) NOT NULL,
    currency            char(3),
    code                text,
    starts_at           timestamptz NOT NULL DEFAULT now(),
    ends_at             timestamptz,
    max_redemptions     integer,
    redemption_count    integer NOT NULL DEFAULT 0,
    funder              text NOT NULL DEFAULT 'platform',
    status              text NOT NULL DEFAULT 'draft',
    created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_by         uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT monetization_campaigns_type_check CHECK (campaign_type IN ('platform', 'trader', 'referral')),
    CONSTRAINT monetization_campaigns_discount_check CHECK (discount_type IN ('percentage', 'fixed')),
    CONSTRAINT monetization_campaigns_funder_check CHECK (funder IN ('platform', 'trader')),
    CONSTRAINT monetization_campaigns_status_check CHECK (status IN (
        'draft', 'pending', 'active', 'paused', 'ended', 'rejected'
    ))
);

CREATE UNIQUE INDEX monetization_campaigns_code_idx
    ON monetization_campaigns (upper(code)) WHERE code IS NOT NULL;

CREATE TRIGGER monetization_campaigns_set_updated_at BEFORE UPDATE ON monetization_campaigns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE campaign_redemptions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         uuid NOT NULL REFERENCES monetization_campaigns(id) ON DELETE CASCADE,
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id     uuid REFERENCES marketplace_subscriptions(id) ON DELETE SET NULL,
    discount_amount_minor bigint NOT NULL DEFAULT 0,
    currency            char(3),
    redeemed_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (campaign_id, user_id, subscription_id)
);

-- -----------------------------------------------------------------------------
-- Payout methods and immutable finance ledger
-- -----------------------------------------------------------------------------
CREATE TABLE platform_payout_methods (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                text NOT NULL UNIQUE,
    name                text NOT NULL,
    method_type         text NOT NULL,
    provider            text,
    enabled             boolean NOT NULL DEFAULT true,
    countries           text[] NOT NULL DEFAULT '{}',
    currencies          text[] NOT NULL DEFAULT '{}',
    min_amount_minor    bigint NOT NULL DEFAULT 0,
    max_amount_minor    bigint,
    fee_bps             integer NOT NULL DEFAULT 0,
    fee_fixed_minor     bigint NOT NULL DEFAULT 0,
    settlement_days     integer NOT NULL DEFAULT 1,
    config              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT platform_payout_methods_type_check CHECK (method_type IN (
        'bank_transfer', 'local_rail', 'international_transfer', 'provider_account'
    ))
);

CREATE TRIGGER platform_payout_methods_set_updated_at BEFORE UPDATE ON platform_payout_methods
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE platform_finance_ledger (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  uuid NOT NULL,
    entry_sequence  integer NOT NULL DEFAULT 1,
    entry_type      text NOT NULL,
    account         text NOT NULL,
    direction       text NOT NULL,
    amount_minor    bigint NOT NULL,
    currency        char(3) NOT NULL,
    source_type     text,
    source_id       uuid,
    description     text,
    metadata        jsonb,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT platform_finance_ledger_direction_check CHECK (direction IN ('debit', 'credit')),
    CONSTRAINT platform_finance_ledger_amount_check CHECK (amount_minor > 0),
    CONSTRAINT platform_finance_ledger_entry_check CHECK (entry_type IN (
        'payment', 'platform_commission', 'trader_earning', 'referral_commission',
        'payout_reserved', 'payout_paid', 'payout_reversed', 'refund', 'chargeback',
        'adjustment', 'fee', 'tax', 'settlement'
    ))
);

CREATE INDEX platform_finance_ledger_txn_idx ON platform_finance_ledger (transaction_id);
CREATE INDEX platform_finance_ledger_account_idx ON platform_finance_ledger (account, created_at DESC);
CREATE INDEX platform_finance_ledger_source_idx ON platform_finance_ledger (source_type, source_id);

CREATE OR REPLACE FUNCTION reject_finance_ledger_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'platform_finance_ledger is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_finance_ledger_no_update
    BEFORE UPDATE OR DELETE ON platform_finance_ledger
    FOR EACH ROW EXECUTE FUNCTION reject_finance_ledger_mutation();

CREATE TABLE finance_adjustments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  uuid NOT NULL,
    adjustment_type text NOT NULL,
    account         text NOT NULL,
    amount_minor    bigint NOT NULL,
    currency        char(3) NOT NULL,
    reason          text NOT NULL,
    source_type     text,
    source_id       uuid,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_by     uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT finance_adjustments_type_check CHECK (adjustment_type IN ('credit', 'debit', 'reversal'))
);

-- -----------------------------------------------------------------------------
-- Announcements and broadcast campaigns
-- -----------------------------------------------------------------------------
CREATE TABLE platform_announcements (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title               text NOT NULL,
    body                text NOT NULL,
    audience            text NOT NULL DEFAULT 'all',
    audience_filter     jsonb NOT NULL DEFAULT '{}'::jsonb,
    channels            text[] NOT NULL DEFAULT '{in_app}',
    status              text NOT NULL DEFAULT 'draft',
    scheduled_at        timestamptz,
    sent_at             timestamptz,
    recipient_count     integer NOT NULL DEFAULT 0,
    delivery_failures   integer NOT NULL DEFAULT 0,
    created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT platform_announcements_audience_check CHECK (audience IN (
        'all', 'selected', 'subscription', 'workspace_type'
    )),
    CONSTRAINT platform_announcements_status_check CHECK (status IN (
        'draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed'
    ))
);

CREATE TRIGGER platform_announcements_set_updated_at BEFORE UPDATE ON platform_announcements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Deployment history and internal admin notes
-- -----------------------------------------------------------------------------
CREATE TABLE platform_deployments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version         text NOT NULL,
    environment     text NOT NULL DEFAULT 'production',
    status          text NOT NULL DEFAULT 'deployed',
    commit_ref      text,
    release_notes   text,
    deployed_by     uuid REFERENCES users(id) ON DELETE SET NULL,
    deployed_at     timestamptz NOT NULL DEFAULT now(),
    rolled_back_at  timestamptz,
    CONSTRAINT platform_deployments_status_check CHECK (status IN (
        'deploying', 'deployed', 'failed', 'rolled_back'
    ))
);

CREATE TABLE admin_internal_notes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    note            text NOT NULL,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE INDEX admin_internal_notes_resource_idx
    ON admin_internal_notes (resource_type, resource_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Unified read-only finance ledger view across existing ledgers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW finance_ledger_view AS
SELECT
    l.id,
    l.id AS transaction_id,
    'platform'::text AS ledger,
    l.entry_type,
    l.account,
    l.direction,
    l.amount_minor,
    l.currency,
    l.source_type,
    l.source_id,
    l.description,
    l.created_at,
    l.created_by
FROM platform_finance_ledger l
UNION ALL
SELECT
    b.id,
    b.id,
    'billing',
    b.entry_type,
    'subscription_billing',
    CASE WHEN b.amount_minor >= 0 THEN 'credit' ELSE 'debit' END,
    abs(b.amount_minor),
    b.currency,
    b.source_type,
    b.source_id,
    b.metadata ->> 'description',
    b.created_at,
    NULL
FROM billing_ledger_entries b
UNION ALL
SELECT
    e.id,
    e.id,
    'trader_earnings',
    'trader_earning',
    'trader_payable',
    'credit',
    e.trader_net_amount_minor,
    e.currency,
    'marketplace_trader_earnings',
    e.id,
    'Trader subscription earning',
    e.created_at,
    NULL
FROM marketplace_trader_earnings e
UNION ALL
SELECT
    p.id,
    p.id,
    'payouts',
    CASE WHEN p.status IN ('paid', 'completed') THEN 'payout_paid' ELSE 'payout_reserved' END,
    'payout_clearing',
    'debit',
    p.amount_minor,
    p.currency,
    'marketplace_trader_payout_requests',
    p.id,
    COALESCE(p.note, 'Trader payout request'),
    p.created_at,
    p.requested_by
FROM marketplace_trader_payout_requests p
UNION ALL
SELECT
    r.id,
    r.id,
    'refunds',
    'refund',
    'customer_receivable',
    'debit',
    r.amount_minor,
    r.currency,
    'refund_records',
    r.id,
    r.reason,
    r.created_at,
    r.requested_by
FROM refund_records r;

-- -----------------------------------------------------------------------------
-- Default platform settings
-- -----------------------------------------------------------------------------
INSERT INTO platform_settings (key, category, value, description) VALUES
    ('platform.maintenance_mode', 'maintenance', '{"enabled": false, "message": "", "scheduledAt": null}'::jsonb, 'Global maintenance mode'),
    ('platform.registration_open', 'general', '{"enabled": true}'::jsonb, 'Whether new registrations are accepted'),
    ('platform.supported_currencies', 'currency', '{"values": ["USD", "NGN", "EUR", "GBP"]}'::jsonb, 'Supported billing currencies'),
    ('platform.supported_locales', 'regional', '{"values": ["en"]}'::jsonb, 'Supported platform locales'),
    ('trading.order_types', 'trading', '{"spot": ["market", "limit"], "futures": ["market", "limit", "stop_market", "stop_limit"]}'::jsonb, 'Enabled order types'),
    ('trading.execution_timeout_ms', 'trading', '{"value": 15000}'::jsonb, 'Exchange execution timeout'),
    ('trading.reconciliation_interval_seconds', 'trading', '{"value": 300}'::jsonb, 'Order reconciliation cadence'),
    ('trading.retry_policy', 'trading', '{"maxAttempts": 3, "backoffMs": 1000}'::jsonb, 'Execution retry policy'),
    ('trading.global_limits', 'trading', '{"maxNotionalPerOrder": null, "maxOrdersPerMinute": 120}'::jsonb, 'Global trading limits'),
    ('synchronization.max_destinations', 'synchronization', '{"value": 10}'::jsonb, 'Maximum destinations per sync group'),
    ('synchronization.modes', 'synchronization', '{"values": ["mirror", "inverse"]}'::jsonb, 'Allowed synchronization modes'),
    ('synchronization.default_sizing', 'synchronization', '{"mode": "proportional", "value": 1}'::jsonb, 'Default destination sizing'),
    ('synchronization.circuit_breaker', 'synchronization', '{"failureThreshold": 5, "windowSeconds": 300}'::jsonb, 'Circuit breaker thresholds'),
    ('copy_trading.enabled', 'copy_trading', '{"enabled": true}'::jsonb, 'Global copy trading availability'),
    ('copy_trading.max_followers', 'copy_trading', '{"value": 500}'::jsonb, 'Maximum followers per trader'),
    ('signals.ingestion_enabled', 'signals', '{"enabled": true}'::jsonb, 'Signal ingestion availability'),
    ('signals.retention_days', 'signals', '{"value": 180}'::jsonb, 'Signal retention window'),
    ('ai.provider', 'ai', '{"value": "groq"}'::jsonb, 'Enabled AI provider'),
    ('ai.model', 'ai', '{"value": "openai/gpt-oss-20b"}'::jsonb, 'Active parsing model'),
    ('ai.confidence_threshold', 'ai', '{"value": 0.7}'::jsonb, 'Minimum confidence before execution eligibility'),
    ('ai.supported_languages', 'ai', '{"values": ["en"]}'::jsonb, 'Supported signal languages'),
    ('ai.parsing_instructions', 'ai', '{"value": "Extract instrument, direction, entry, stop loss, take profit, leverage and validity. Never authorise execution."}'::jsonb, 'AI parsing instructions'),
    ('ai.error_handling', 'ai', '{"mode": "reject", "maxRetries": 2}'::jsonb, 'AI error handling behaviour'),
    ('marketplace.listing_visibility', 'marketplace', '{"value": "public"}'::jsonb, 'Marketplace listing visibility'),
    ('marketplace.featured_enabled', 'marketplace', '{"enabled": true}'::jsonb, 'Featured listings availability'),
    ('marketplace.moderation_rules', 'marketplace', '{"requireApproval": false, "autoHideReportThreshold": 3}'::jsonb, 'Marketplace moderation policy'),
    ('community.guidelines_version', 'community', '{"value": "1.0"}'::jsonb, 'Community guidelines version'),
    ('community.posting_enabled', 'community', '{"enabled": true}'::jsonb, 'Community posting availability'),
    ('billing.grace_period_days', 'billing', '{"value": 5}'::jsonb, 'Failed payment grace period'),
    ('billing.retry_schedule_days', 'billing', '{"values": [1, 3, 5]}'::jsonb, 'Payment retry schedule'),
    ('billing.refund_window_days', 'billing', '{"value": 14}'::jsonb, 'Refund eligibility window'),
    ('referral.commission_rate_bps', 'referral', '{"value": 2000}'::jsonb, 'Default referral commission rate'),
    ('referral.holding_period_days', 'referral', '{"value": 30}'::jsonb, 'Commission holding period'),
    ('referral.recurring_enabled', 'referral', '{"enabled": true}'::jsonb, 'Recurring commission eligibility'),
    ('trader_monetization.enabled', 'trader_monetization', '{"enabled": true}'::jsonb, 'Trader monetization availability'),
    ('trader_monetization.commission_rate_bps', 'trader_monetization', '{"value": 2000}'::jsonb, 'Default platform commission on trader sales'),
    ('trader_monetization.min_price_minor', 'trader_monetization', '{"value": 100}'::jsonb, 'Minimum trader package price'),
    ('trader_monetization.max_price_minor', 'trader_monetization', '{"value": 1000000}'::jsonb, 'Maximum trader package price'),
    ('payouts.dual_approval_threshold_minor', 'payouts', '{"value": 100000}'::jsonb, 'Dual approval threshold'),
    ('payouts.minimum_amount_minor', 'payouts', '{"value": 1000}'::jsonb, 'Minimum payout amount'),
    ('payouts.settlement_delay_days', 'payouts', '{"value": 7}'::jsonb, 'Earnings settlement delay'),
    ('payouts.hold_period_days', 'payouts', '{"value": 3}'::jsonb, 'Payout review hold period'),
    ('notifications.email_enabled', 'notifications', '{"enabled": true}'::jsonb, 'Email notification delivery'),
    ('notifications.push_enabled', 'notifications', '{"enabled": true}'::jsonb, 'Push notification delivery'),
    ('security.require_admin_mfa', 'security', '{"enabled": true}'::jsonb, 'Require MFA for administrators'),
    ('security.session_timeout_minutes', 'security', '{"value": 60}'::jsonb, 'Administrator session timeout'),
    ('security.max_failed_logins', 'security', '{"value": 5}'::jsonb, 'Failed login lockout threshold'),
    ('developer.api_enabled', 'api', '{"enabled": true}'::jsonb, 'Developer API availability'),
    ('developer.rate_limit_per_minute', 'api', '{"value": 600}'::jsonb, 'Default developer API rate limit')
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_commission_rules (product_type, rate_bps, applies_to_existing, status, notes) VALUES
    ('trader_subscription', 2000, false, 'active', 'Default platform share of trader subscription sales'),
    ('premium_signal', 2000, false, 'active', 'Default platform share of premium signal sales'),
    ('premium_strategy', 2000, false, 'active', 'Default platform share of premium strategy sales'),
    ('copy_trading_service', 0, false, 'active', 'Copy trading service fee, configured per product'),
    ('marketplace_service', 0, false, 'active', 'Marketplace service fee')
ON CONFLICT DO NOTHING;

INSERT INTO platform_payout_methods (code, name, method_type, provider, countries, currencies, min_amount_minor, settlement_days) VALUES
    ('bank_transfer', 'Bank transfer', 'bank_transfer', 'manual', '{NG,US,GB,EU}', '{NGN,USD,EUR,GBP}', 1000, 3),
    ('stripe_connect', 'Stripe Connect', 'provider_account', 'stripe', '{US,GB,EU,CA}', '{USD,EUR,GBP}', 1000, 2),
    ('flutterwave_transfer', 'Flutterwave transfer', 'local_rail', 'flutterwave', '{NG,GH,KE,ZA}', '{NGN,GHS,KES,ZAR}', 1000, 2)
ON CONFLICT (code) DO NOTHING;
