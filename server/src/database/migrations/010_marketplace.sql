-- =============================================================================
-- 010_marketplace.sql
-- Module 10 — Copy Trading and Signal Marketplace
-- =============================================================================

-- -----------------------------------------------------------------------------
-- marketplace_provider_profiles
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_provider_profiles (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    handle            text NOT NULL UNIQUE,
    display_name      text NOT NULL,
    account_type      text NOT NULL,
    moderation_state  text NOT NULL DEFAULT 'pending_review',
    biography         text,
    methodology       text,
    supported_markets text[] NOT NULL DEFAULT '{}',
    supported_languages text[] NOT NULL DEFAULT '{}',
    avatar_url        text,
    current_version   integer NOT NULL DEFAULT 1,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT marketplace_provider_profiles_type_check CHECK (account_type IN (
        'individual', 'organization', 'platform_managed', 'restricted'
    )),
    CONSTRAINT marketplace_provider_profiles_state_check CHECK (moderation_state IN (
        'pending_review', 'approved', 'additional_information_required',
        'restricted', 'suspended', 'rejected', 'appeal_pending'
    ))
);

CREATE TRIGGER marketplace_provider_profiles_set_updated_at
    BEFORE UPDATE ON marketplace_provider_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- marketplace_provider_profile_versions
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_provider_profile_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    snapshot        jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_id, version)
);

-- -----------------------------------------------------------------------------
-- marketplace_provider_memberships
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_provider_memberships (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            text NOT NULL,
    status          text NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_id, user_id)
);

-- -----------------------------------------------------------------------------
-- marketplace_provider_permissions
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_provider_permissions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    permission_key  text NOT NULL,
    granted_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_id, permission_key)
);

-- -----------------------------------------------------------------------------
-- marketplace_published_signals
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_published_signals (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id       uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    source_signal_id  uuid REFERENCES trading_signal_candidates(id) ON DELETE SET NULL,
    instrument        text NOT NULL,
    market_type       text NOT NULL,
    direction         text NOT NULL,
    entry             numeric(30, 12),
    entry_range       jsonb,
    stop_loss         numeric(30, 12),
    leverage          numeric(20, 6),
    status            text NOT NULL DEFAULT 'draft',
    current_version   integer NOT NULL DEFAULT 1,
    valid_until       timestamptz,
    metadata          jsonb,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT marketplace_published_signals_direction_check CHECK (direction IN ('long', 'short')),
    CONSTRAINT marketplace_published_signals_status_check CHECK (status IN (
        'draft', 'pending_validation', 'pending_review', 'published', 'updated',
        'cancelled', 'expired', 'closed', 'rejected', 'withdrawn'
    ))
);

CREATE INDEX marketplace_published_signals_provider_idx ON marketplace_published_signals (provider_id, created_at DESC);

CREATE TRIGGER marketplace_published_signals_set_updated_at
    BEFORE UPDATE ON marketplace_published_signals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- marketplace_published_signal_versions
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_published_signal_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id       uuid NOT NULL REFERENCES marketplace_published_signals(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    snapshot        jsonb NOT NULL,
    change_reason   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (signal_id, version)
);

-- -----------------------------------------------------------------------------
-- marketplace_signal_publications
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_signal_publications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id       uuid NOT NULL REFERENCES marketplace_published_signals(id) ON DELETE CASCADE,
    channel         text NOT NULL,
    visibility      text NOT NULL,
    published_at    timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- marketplace_signal_disclosures
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_signal_disclosures (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    scope           text NOT NULL,
    version         text NOT NULL,
    content         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- marketplace_disclosure_acceptances
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_disclosure_acceptances (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    disclosure_id   uuid NOT NULL REFERENCES marketplace_signal_disclosures(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    accepted_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (disclosure_id, user_id)
);

-- -----------------------------------------------------------------------------
-- marketplace_provider_plans
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_provider_plans (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    name            text NOT NULL,
    pricing         jsonb NOT NULL,
    entitlements    jsonb NOT NULL DEFAULT '{}'::jsonb,
    status          text NOT NULL DEFAULT 'draft',
    version         integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT marketplace_provider_plans_status_check CHECK (status IN ('draft', 'active', 'retired', 'archived'))
);

CREATE TRIGGER marketplace_provider_plans_set_updated_at
    BEFORE UPDATE ON marketplace_provider_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- marketplace_provider_plan_versions
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_provider_plan_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         uuid NOT NULL REFERENCES marketplace_provider_plans(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    snapshot        jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id, version)
);

-- -----------------------------------------------------------------------------
-- marketplace_subscriptions
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_subscriptions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    plan_id         uuid REFERENCES marketplace_provider_plans(id) ON DELETE SET NULL,
    subscriber_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'subscription_pending',
    current_period_start timestamptz,
    current_period_end timestamptz,
    canceled_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT marketplace_subscriptions_status_check CHECK (status IN (
        'following', 'subscription_pending', 'active', 'past_due',
        'canceled', 'expired', 'suspended', 'access_revoked'
    ))
);

CREATE INDEX marketplace_subscriptions_subscriber_idx ON marketplace_subscriptions (subscriber_user_id, status);
CREATE UNIQUE INDEX marketplace_subscriptions_active_unique
    ON marketplace_subscriptions (provider_id, subscriber_user_id)
    WHERE status IN ('active', 'trialing', 'past_due');

CREATE TRIGGER marketplace_subscriptions_set_updated_at
    BEFORE UPDATE ON marketplace_subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- marketplace_subscription_events
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_subscription_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid NOT NULL REFERENCES marketplace_subscriptions(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- marketplace_follows
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_follows (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    follower_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_id, follower_user_id)
);

-- -----------------------------------------------------------------------------
-- copy_configurations
-- -----------------------------------------------------------------------------
CREATE TABLE copy_configurations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider_id     uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    provider_plan_id uuid REFERENCES marketplace_provider_plans(id) ON DELETE SET NULL,
    sizing_rule     jsonb NOT NULL,
    instrument_filters text[],
    market_types    text[] NOT NULL DEFAULT '{}',
    execution_mode  text NOT NULL,
    status          text NOT NULL DEFAULT 'draft',
    current_version integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT copy_configurations_status_check CHECK (status IN (
        'draft', 'pending_validation', 'active', 'paused', 'revoked', 'needs_attention'
    )),
    CONSTRAINT copy_configurations_execution_check CHECK (execution_mode IN (
        'monitor_only', 'confirm_before_execution', 'authorized_automation'
    ))
);

CREATE INDEX copy_configurations_workspace_idx ON copy_configurations (workspace_id, status);

CREATE TRIGGER copy_configurations_set_updated_at BEFORE UPDATE ON copy_configurations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- copy_configuration_versions
-- -----------------------------------------------------------------------------
CREATE TABLE copy_configuration_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id       uuid NOT NULL REFERENCES copy_configurations(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    snapshot        jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (config_id, version)
);

-- -----------------------------------------------------------------------------
-- copy_destination_accounts
-- -----------------------------------------------------------------------------
CREATE TABLE copy_destination_accounts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id       uuid NOT NULL REFERENCES copy_configurations(id) ON DELETE CASCADE,
    connection_id   uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE RESTRICT,
    account_id      uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE RESTRICT,
    status          text NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (config_id, account_id)
);

-- -----------------------------------------------------------------------------
-- copy_permission_grants
-- -----------------------------------------------------------------------------
CREATE TABLE copy_permission_grants (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id       uuid NOT NULL REFERENCES copy_configurations(id) ON DELETE CASCADE,
    granted_by      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    granted_at      timestamptz NOT NULL DEFAULT now(),
    revoked_at      timestamptz,
    scope           jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- -----------------------------------------------------------------------------
-- copy_signal_processing_records
-- -----------------------------------------------------------------------------
CREATE TABLE copy_signal_processing_records (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    published_signal_id   uuid NOT NULL REFERENCES marketplace_published_signals(id) ON DELETE CASCADE,
    config_id             uuid NOT NULL REFERENCES copy_configurations(id) ON DELETE CASCADE,
    subscriber_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    config_version        integer NOT NULL,
    outcome               text NOT NULL,
    skip_reason           text,
    allocation_decision   jsonb,
    risk_evaluation_id    uuid,
    execution_intent_id   uuid,
    idempotency_key       text NOT NULL UNIQUE,
    processing_timestamp  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT copy_signal_processing_records_outcome_check CHECK (outcome IN (
        'pending', 'eligible', 'held', 'skipped', 'executed', 'failed'
    ))
);

CREATE INDEX copy_signal_processing_records_config_idx
    ON copy_signal_processing_records (config_id, processing_timestamp DESC);

-- -----------------------------------------------------------------------------
-- copy_signal_destination_results
-- -----------------------------------------------------------------------------
CREATE TABLE copy_signal_destination_results (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    processing_record_id  uuid NOT NULL REFERENCES copy_signal_processing_records(id) ON DELETE CASCADE,
    destination_account_id uuid NOT NULL REFERENCES copy_destination_accounts(id) ON DELETE CASCADE,
    outcome               text NOT NULL,
    skip_reason           text,
    destination_order_id  uuid REFERENCES trading_orders(id) ON DELETE SET NULL,
    error_message         text,
    created_at            timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- copy_execution_intents
-- -----------------------------------------------------------------------------
CREATE TABLE copy_execution_intents (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    processing_record_id  uuid NOT NULL REFERENCES copy_signal_processing_records(id) ON DELETE CASCADE,
    intent_payload        jsonb NOT NULL,
    idempotency_key       text NOT NULL UNIQUE,
    status                text NOT NULL DEFAULT 'created',
    created_at            timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- marketplace_performance_reports
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_performance_reports (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    methodology_version text NOT NULL,
    period_start    timestamptz NOT NULL,
    period_end      timestamptz NOT NULL,
    metrics         jsonb NOT NULL,
    completeness    jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_id, methodology_version, period_start, period_end)
);

-- -----------------------------------------------------------------------------
-- marketplace_performance_observations
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_performance_observations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id       uuid NOT NULL REFERENCES marketplace_published_signals(id) ON DELETE CASCADE,
    observed_at     timestamptz NOT NULL,
    outcome         text,
    evidence        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- marketplace_performance_methodologies
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_performance_methodologies (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version         text NOT NULL UNIQUE,
    description     text NOT NULL,
    calculation     jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- marketplace_moderation_cases
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_moderation_cases (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     uuid REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    signal_id       uuid REFERENCES marketplace_published_signals(id) ON DELETE CASCADE,
    state           text NOT NULL DEFAULT 'pending_review',
    category        text,
    opened_at       timestamptz NOT NULL DEFAULT now(),
    closed_at       timestamptz,
    CONSTRAINT marketplace_moderation_cases_state_check CHECK (state IN (
        'pending_review', 'approved', 'additional_information_required',
        'restricted', 'suspended', 'rejected', 'appeal_pending', 'resolved'
    ))
);

-- -----------------------------------------------------------------------------
-- marketplace_moderation_events
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_moderation_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         uuid NOT NULL REFERENCES marketplace_moderation_cases(id) ON DELETE CASCADE,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    action          text NOT NULL,
    reason          text,
    evidence        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- marketplace_complaints
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_complaints (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id     uuid REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    signal_id       uuid REFERENCES marketplace_published_signals(id) ON DELETE SET NULL,
    category        text NOT NULL,
    description     text,
    status          text NOT NULL DEFAULT 'open',
    created_at      timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz,
    CONSTRAINT marketplace_complaints_status_check CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed'))
);

-- -----------------------------------------------------------------------------
-- marketplace_audit_events
-- -----------------------------------------------------------------------------
CREATE TABLE marketplace_audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    provider_id     uuid REFERENCES marketplace_provider_profiles(id) ON DELETE SET NULL,
    action          text NOT NULL,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    before          jsonb,
    after           jsonb,
    outcome         text NOT NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);