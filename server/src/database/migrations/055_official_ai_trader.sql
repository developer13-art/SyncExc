-- =============================================================================
-- 055_official_ai_trader.sql
-- Execution-backed Official SyncExc AI Trader
--
-- The existing `syncexc-official` marketplace provider publishes research-only
-- signals. This migration introduces the records required to execute eligible
-- analyses through an administrator-connected exchange account and to derive
-- performance from actual exchange fills and closed trades.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Provider ownership
-- -----------------------------------------------------------------------------
ALTER TABLE marketplace_provider_profiles
    ADD COLUMN IF NOT EXISTS platform_owned boolean NOT NULL DEFAULT false;

UPDATE marketplace_provider_profiles
SET display_name = 'SyncExc Official AI Trader',
    account_type = 'platform_managed',
    platform_owned = true,
    moderation_state = 'approved',
    visibility = 'public',
    biography = 'The official SyncExc AI trading service. Market research is generated automatically, every eligible trade is validated by the SyncExc risk engine and executed through a platform-controlled exchange account, and performance is calculated from reconciled exchange fills.',
    methodology = 'Researches liquid supported markets on configurable timeframes using exchange market data and technical indicators. An analysis is executed only after deterministic exchange, balance, precision, risk and exposure validation. Published trades link to verified official execution records. Fees, funding and realized PnL are taken from exchange records where available.',
    updated_at = now()
WHERE handle = 'syncexc-official';

-- Update the seeded free plan label and entitlements without changing its price.
UPDATE marketplace_provider_plans plan
SET name = 'Official AI Trader Access',
    entitlements = '{"signals":true,"copyTrading":true,"strategyAccess":true}'::jsonb,
    pricing = jsonb_set(
        jsonb_set(plan.pricing, '{billingInterval}', '"monthly"'::jsonb, true),
        '{currency}', COALESCE(plan.pricing->'currency', '"USD"'::jsonb), true
    ),
    updated_at = now()
FROM marketplace_provider_profiles provider
WHERE plan.provider_id = provider.id
  AND provider.handle = 'syncexc-official'
  AND plan.name IN ('Official Signals', 'Official AI Trader Access');

-- -----------------------------------------------------------------------------
-- Settings (one row per official provider)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS official_trader_settings (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id              uuid NOT NULL UNIQUE REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    status                   text NOT NULL DEFAULT 'enabled'
                             CHECK (status IN ('enabled', 'paused', 'suspended')),
    research_enabled         boolean NOT NULL DEFAULT true,
    execution_enabled        boolean NOT NULL DEFAULT false,
    research_interval_minutes integer NOT NULL DEFAULT 15
                             CHECK (research_interval_minutes BETWEEN 5 AND 1440),
    research_timeframes      text[] NOT NULL DEFAULT ARRAY['15m', '1h', '4h'],
    primary_timeframe        text NOT NULL DEFAULT '1h',
    min_confidence           numeric(5, 4) NOT NULL DEFAULT 0.80
                             CHECK (min_confidence >= 0 AND min_confidence <= 1),
    max_analyses_per_run     integer NOT NULL DEFAULT 3
                             CHECK (max_analyses_per_run BETWEEN 1 AND 20),
    allowed_market_types     text[] NOT NULL DEFAULT ARRAY['futures'],
    allowed_strategies       text[] NOT NULL DEFAULT ARRAY['trend_following', 'breakout', 'momentum'],
    max_risk_per_trade_pct   numeric(8, 4) NOT NULL DEFAULT 1,
    max_order_notional       numeric(24, 8) NOT NULL DEFAULT 1000,
    max_open_positions       integer NOT NULL DEFAULT 3,
    max_daily_exposure       numeric(24, 8) NOT NULL DEFAULT 5000,
    max_leverage             numeric(10, 4) NOT NULL DEFAULT 3,
    max_daily_loss           numeric(24, 8) NOT NULL DEFAULT 200,
    max_drawdown_pct         numeric(8, 4) NOT NULL DEFAULT 15,
    max_slippage_bps         integer NOT NULL DEFAULT 50,
    trading_schedule         jsonb NOT NULL DEFAULT '{"timezone":"UTC","days":[1,2,3,4,5,6,7],"start":"00:00","end":"23:59"}'::jsonb,
    publication_mode         text NOT NULL DEFAULT 'execution_verified'
                             CHECK (publication_mode IN ('execution_verified', 'research_only')),
    require_stop_loss        boolean NOT NULL DEFAULT true,
    copy_trading_enabled     boolean NOT NULL DEFAULT true,
    last_research_at         timestamptz,
    last_execution_at        timestamptz,
    last_reconciled_at       timestamptz,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER official_trader_settings_set_updated_at
    BEFORE UPDATE ON official_trader_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO official_trader_settings (provider_id)
SELECT provider.id
FROM marketplace_provider_profiles provider
WHERE provider.handle = 'syncexc-official'
ON CONFLICT (provider_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Official exchange account assignments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS official_trader_connections (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id           uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    connection_id         uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    account_id            uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
    exchange_code         text NOT NULL,
    environment           text NOT NULL,
    label                 text,
    is_default            boolean NOT NULL DEFAULT false,
    status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'paused', 'disconnected')),
    allowed_market_types  text[] NOT NULL DEFAULT ARRAY['spot', 'futures'],
    allowed_symbols       text[] NOT NULL DEFAULT '{}',
    max_order_notional    numeric(24, 8),
    max_open_positions    integer,
    max_daily_exposure    numeric(24, 8),
    max_leverage          numeric(10, 4),
    max_daily_loss        numeric(24, 8),
    max_drawdown_pct      numeric(8, 4),
    max_slippage_bps      integer,
    created_by            uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (connection_id, account_id)
);

CREATE UNIQUE INDEX official_trader_connections_default_unique
    ON official_trader_connections (provider_id)
    WHERE is_default = true AND status = 'active';
CREATE INDEX official_trader_connections_provider_idx
    ON official_trader_connections (provider_id, status);

CREATE TRIGGER official_trader_connections_set_updated_at
    BEFORE UPDATE ON official_trader_connections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Research runs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS official_trader_research_runs (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id          uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    status               text NOT NULL DEFAULT 'running'
                         CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
    timeframes           text[] NOT NULL DEFAULT '{}',
    symbols              jsonb NOT NULL DEFAULT '[]'::jsonb,
    data_sources         jsonb NOT NULL DEFAULT '[]'::jsonb,
    ai_provider          text,
    ai_model             text,
    candidates_generated integer NOT NULL DEFAULT 0,
    analyses_created     integer NOT NULL DEFAULT 0,
    rejected             integer NOT NULL DEFAULT 0,
    summary              jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_message        text,
    started_at           timestamptz NOT NULL DEFAULT now(),
    completed_at         timestamptz
);

CREATE INDEX official_trader_research_provider_idx
    ON official_trader_research_runs (provider_id, started_at DESC);

-- -----------------------------------------------------------------------------
-- Structured AI trade analyses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS official_trader_analyses (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id           uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    research_run_id       uuid REFERENCES official_trader_research_runs(id) ON DELETE SET NULL,
    connection_id         uuid REFERENCES exchange_connections(id) ON DELETE SET NULL,
    account_id            uuid REFERENCES exchange_accounts(id) ON DELETE SET NULL,
    exchange_code         text NOT NULL,
    instrument            text NOT NULL,
    market_type           text NOT NULL,
    direction             text NOT NULL CHECK (direction IN ('long', 'short')),
    strategy_key          text NOT NULL,
    timeframe             text NOT NULL,
    entry_price           numeric(30, 12),
    entry_low             numeric(30, 12),
    entry_high            numeric(30, 12),
    stop_loss             numeric(30, 12),
    targets               jsonb NOT NULL DEFAULT '[]'::jsonb,
    risk_reward           numeric(20, 8),
    position_size         numeric(30, 12),
    risk_percentage       numeric(10, 4),
    leverage              numeric(10, 4),
    confidence            numeric(5, 4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    market_condition      text,
    reasoning             text NOT NULL,
    invalidation_condition text,
    data_sources          jsonb NOT NULL DEFAULT '[]'::jsonb,
    indicators            jsonb NOT NULL DEFAULT '{}'::jsonb,
    status                text NOT NULL DEFAULT 'generated'
                          CHECK (status IN (
                              'generated', 'validated', 'rejected', 'execution_pending',
                              'executed', 'partially_executed', 'published', 'expired',
                              'research_only', 'failed'
                          )),
    validation_result     jsonb,
    rejection_reason      text,
    risk_evaluation_id    uuid,
    published_signal_id   uuid REFERENCES marketplace_published_signals(id) ON DELETE SET NULL,
    expires_at            timestamptz,
    validated_at          timestamptz,
    executed_at           timestamptz,
    published_at          timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX official_trader_analyses_provider_idx
    ON official_trader_analyses (provider_id, created_at DESC);
CREATE INDEX official_trader_analyses_status_idx
    ON official_trader_analyses (provider_id, status, created_at DESC);
CREATE INDEX official_trader_analyses_instrument_idx
    ON official_trader_analyses (exchange_code, instrument, market_type, created_at DESC);

CREATE TRIGGER official_trader_analyses_set_updated_at
    BEFORE UPDATE ON official_trader_analyses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Official executions (one or more attempts per analysis)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS official_trader_executions (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id           uuid NOT NULL REFERENCES official_trader_analyses(id) ON DELETE CASCADE,
    provider_id           uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    connection_id         uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE RESTRICT,
    account_id            uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE RESTRICT,
    execution_number      integer NOT NULL DEFAULT 1,
    trading_order_id      uuid UNIQUE REFERENCES trading_orders(id) ON DELETE SET NULL,
    exchange_order_id     text,
    client_order_id       text,
    instrument            text NOT NULL,
    market_type           text NOT NULL,
    side                  text NOT NULL CHECK (side IN ('buy', 'sell')),
    order_type            text NOT NULL,
    requested_quantity    numeric(30, 12) NOT NULL,
    filled_quantity       numeric(30, 12) NOT NULL DEFAULT 0,
    average_fill_price    numeric(30, 12),
    fees                  numeric(30, 12) NOT NULL DEFAULT 0,
    fee_asset             text,
    status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                              'pending', 'awaiting_confirmation', 'submitted', 'partially_filled',
                              'filled', 'canceled', 'rejected', 'failed', 'uncertain',
                              'reconciled', 'superseded'
                          )),
    exchange_response     jsonb,
    error_message         text,
    submitted_at          timestamptz,
    last_reconciled_at    timestamptz,
    closed_at             timestamptz,
    realized_pnl          numeric(30, 12),
    pnl_asset             text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (analysis_id, execution_number)
);

CREATE INDEX official_trader_executions_provider_idx
    ON official_trader_executions (provider_id, created_at DESC);
CREATE INDEX official_trader_executions_status_idx
    ON official_trader_executions (provider_id, status, created_at DESC);
CREATE INDEX official_trader_executions_order_idx
    ON official_trader_executions (trading_order_id);

CREATE TRIGGER official_trader_executions_set_updated_at
    BEFORE UPDATE ON official_trader_executions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Verified fills linked to official executions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS official_trader_fills (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id       uuid NOT NULL REFERENCES official_trader_executions(id) ON DELETE CASCADE,
    trading_fill_id    uuid NOT NULL UNIQUE REFERENCES trading_fills(id) ON DELETE CASCADE,
    exchange_trade_id  text,
    quantity           numeric(30, 12) NOT NULL,
    price              numeric(30, 12) NOT NULL,
    fee_amount         numeric(30, 12),
    fee_asset          text,
    executed_at        timestamptz NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX official_trader_fills_execution_idx
    ON official_trader_fills (execution_id, executed_at);

-- -----------------------------------------------------------------------------
-- Closed-trade attribution
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS official_trader_closures (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id             uuid NOT NULL UNIQUE REFERENCES official_trader_executions(id) ON DELETE CASCADE,
    provider_id              uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    trading_closed_trade_id  uuid UNIQUE REFERENCES trading_closed_trades(id) ON DELETE SET NULL,
    closing_fill_id          uuid REFERENCES trading_fills(id) ON DELETE SET NULL,
    closed_at                timestamptz NOT NULL,
    realized_pnl             numeric(30, 12) NOT NULL,
    fees                     numeric(30, 12) NOT NULL DEFAULT 0,
    pnl_asset                text,
    outcome                  text NOT NULL CHECK (outcome IN ('win', 'loss', 'breakeven')),
    created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX official_trader_closures_provider_idx
    ON official_trader_closures (provider_id, closed_at DESC);

-- -----------------------------------------------------------------------------
-- Lifecycle event log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS official_trader_events (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id  uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    analysis_id  uuid REFERENCES official_trader_analyses(id) ON DELETE SET NULL,
    execution_id uuid REFERENCES official_trader_executions(id) ON DELETE SET NULL,
    event_type   text NOT NULL,
    message      text,
    payload      jsonb,
    actor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX official_trader_events_provider_idx
    ON official_trader_events (provider_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Performance snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS official_trader_performance_snapshots (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id   uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    period_start  timestamptz NOT NULL,
    period_end    timestamptz NOT NULL,
    metrics       jsonb NOT NULL,
    methodology   jsonb NOT NULL,
    calculated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_id, period_start, period_end)
);

CREATE INDEX official_trader_performance_provider_idx
    ON official_trader_performance_snapshots (provider_id, period_end DESC);

-- -----------------------------------------------------------------------------
-- Admin permissions
-- -----------------------------------------------------------------------------
INSERT INTO admin_permission_definitions (permission_key, category, description)
VALUES
    ('admin.official_trader.view', 'official_trader', 'View the Official AI Trader administration section'),
    ('admin.official_trader.manage', 'official_trader', 'Manage Official AI Trader connections, analyses, execution and settings')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM admin_role_definitions role
JOIN admin_permission_definitions permission
  ON permission.permission_key IN ('admin.official_trader.view', 'admin.official_trader.manage')
WHERE role.name IN ('platform_administrator', 'platform_operations')
ON CONFLICT DO NOTHING;
