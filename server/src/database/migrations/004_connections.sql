-- =============================================================================
-- 004_connections.sql
-- Module 04 — Exchange Connections and Account Management
-- =============================================================================

-- -----------------------------------------------------------------------------
-- exchange_registry
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_registry (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_code         text NOT NULL UNIQUE,
    display_name          text NOT NULL,
    integration_status    text NOT NULL DEFAULT 'planned',
    supported_regions     text[],
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT exchange_registry_status_check CHECK (integration_status IN (
        'planned', 'in_development', 'testing', 'available', 'degraded', 'maintenance', 'disabled'
    ))
);

CREATE TRIGGER exchange_registry_set_updated_at BEFORE UPDATE ON exchange_registry
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- exchange_adapter_versions
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_adapter_versions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_id       uuid NOT NULL REFERENCES exchange_registry(id) ON DELETE CASCADE,
    version           text NOT NULL,
    lifecycle_state   text NOT NULL DEFAULT 'development',
    release_notes     text,
    activated_at      timestamptz,
    deprecated_at     timestamptz,
    retired_at        timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (exchange_id, version),
    CONSTRAINT exchange_adapter_versions_lifecycle_check CHECK (lifecycle_state IN (
        'development', 'validation', 'staged', 'active', 'restricted', 'deprecated', 'retired'
    ))
);

-- -----------------------------------------------------------------------------
-- exchange_capability_definitions
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_capability_definitions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    capability_key  text NOT NULL UNIQUE,
    category        text NOT NULL,
    description     text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- exchange_capability_support
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_capability_support (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_id        uuid NOT NULL REFERENCES exchange_registry(id) ON DELETE CASCADE,
    capability_key     text NOT NULL REFERENCES exchange_capability_definitions(capability_key) ON DELETE CASCADE,
    market_type        text,
    supported          boolean NOT NULL DEFAULT false,
    required_permission text,
    limitations        jsonb,
    last_validated_at  timestamptz,
    adapter_version_id uuid REFERENCES exchange_adapter_versions(id) ON DELETE SET NULL,
    UNIQUE (exchange_id, capability_key, market_type)
);

-- -----------------------------------------------------------------------------
-- exchange_connections
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_connections (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    owner_id              uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    exchange_code         text NOT NULL REFERENCES exchange_registry(exchange_code) ON DELETE RESTRICT,
    environment           text NOT NULL DEFAULT 'live',
    label                 text NOT NULL,
    status                text NOT NULL DEFAULT 'pending',
    capabilities          jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    last_validated_at     timestamptz,
    disconnected_at       timestamptz,
    CONSTRAINT exchange_connections_environment_check CHECK (environment IN ('live', 'testnet')),
    CONSTRAINT exchange_connections_status_check CHECK (status IN (
        'pending', 'validating', 'active', 'degraded', 'reauth_required',
        'suspended', 'disconnected', 'revoked', 'error'
    ))
);

CREATE INDEX exchange_connections_workspace_idx ON exchange_connections (workspace_id, status);
CREATE INDEX exchange_connections_owner_idx ON exchange_connections (owner_id);
CREATE UNIQUE INDEX exchange_connections_label_unique ON exchange_connections (workspace_id, label)
    WHERE status NOT IN ('disconnected', 'revoked');

CREATE TRIGGER exchange_connections_set_updated_at BEFORE UPDATE ON exchange_connections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- exchange_credentials (encrypted)
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_credentials (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    api_key_encrypted text NOT NULL,
    api_secret_encrypted text NOT NULL,
    passphrase_encrypted text,
    key_version     text NOT NULL DEFAULT '1',
    created_at      timestamptz NOT NULL DEFAULT now(),
    rotated_at      timestamptz,
    revoked_at      timestamptz
);

CREATE INDEX exchange_credentials_connection_idx ON exchange_credentials (connection_id) WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- exchange_credential_rotations
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_credential_rotations (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id         uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    previous_credential_id uuid REFERENCES exchange_credentials(id) ON DELETE SET NULL,
    new_credential_id     uuid REFERENCES exchange_credentials(id) ON DELETE SET NULL,
    rotated_by            uuid REFERENCES users(id) ON DELETE SET NULL,
    reason                text,
    created_at            timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- exchange_connection_permissions
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_connection_permissions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    permission_key  text NOT NULL,
    verification    text NOT NULL DEFAULT 'unknown',
    last_checked_at timestamptz,
    UNIQUE (connection_id, permission_key),
    CONSTRAINT exchange_connection_permissions_verification_check CHECK (verification IN (
        'verified', 'missing_permission', 'unsupported', 'unknown', 'temporarily_unavailable', 'revoked_or_invalid'
    ))
);

-- -----------------------------------------------------------------------------
-- exchange_accounts
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_accounts (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id         uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    exchange_account_id   text,
    account_type          text NOT NULL,
    status                text NOT NULL DEFAULT 'active',
    supported_capabilities text[] NOT NULL DEFAULT '{}',
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    last_sync_at          timestamptz
);

CREATE INDEX exchange_accounts_connection_idx ON exchange_accounts (connection_id);
CREATE UNIQUE INDEX exchange_accounts_unique ON exchange_accounts (connection_id, exchange_account_id, account_type);

-- -----------------------------------------------------------------------------
-- exchange_account_snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_account_snapshots (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
    equity          numeric(30, 12),
    available_margin numeric(30, 12),
    used_margin     numeric(30, 12),
    unrealized_pnl  numeric(30, 12),
    observed_at     timestamptz NOT NULL,
    received_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exchange_account_snapshots_account_idx ON exchange_account_snapshots (account_id, observed_at DESC);

-- -----------------------------------------------------------------------------
-- exchange_balance_snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_balance_snapshots (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
    observed_at     timestamptz NOT NULL,
    received_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exchange_balance_snapshots_account_idx ON exchange_balance_snapshots (account_id, observed_at DESC);

-- -----------------------------------------------------------------------------
-- exchange_balance_items
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_balance_items (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id       uuid NOT NULL REFERENCES exchange_balance_snapshots(id) ON DELETE CASCADE,
    asset             text NOT NULL,
    free              numeric(30, 12) NOT NULL DEFAULT 0,
    used              numeric(30, 12) NOT NULL DEFAULT 0,
    total             numeric(30, 12) NOT NULL DEFAULT 0
);

CREATE INDEX exchange_balance_items_snapshot_idx ON exchange_balance_items (snapshot_id);

-- -----------------------------------------------------------------------------
-- exchange_instruments
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_instruments (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_code         text NOT NULL REFERENCES exchange_registry(exchange_code) ON DELETE CASCADE,
    exchange_symbol       text NOT NULL,
    normalized_symbol     text NOT NULL,
    market_type           text NOT NULL,
    base_asset            text,
    quote_asset           text,
    settlement_asset      text,
    tick_size             numeric(30, 12) NOT NULL,
    quantity_step         numeric(30, 12) NOT NULL,
    minimum_quantity      numeric(30, 12),
    minimum_notional      numeric(30, 12),
    contract_multiplier   numeric(30, 12),
    trading_status        text NOT NULL DEFAULT 'active',
    updated_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (exchange_code, exchange_symbol)
);

CREATE INDEX exchange_instruments_market_idx ON exchange_instruments (market_type, trading_status);

CREATE TRIGGER exchange_instruments_set_updated_at BEFORE UPDATE ON exchange_instruments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- exchange_instrument_versions
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_instrument_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id   uuid NOT NULL REFERENCES exchange_instruments(id) ON DELETE CASCADE,
    snapshot        jsonb NOT NULL,
    observed_at     timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- exchange_connection_health
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_connection_health (
    connection_id        uuid PRIMARY KEY REFERENCES exchange_connections(id) ON DELETE CASCADE,
    state                text NOT NULL DEFAULT 'unknown',
    last_successful_request timestamptz,
    last_successful_sync timestamptz,
    last_error          text,
    latency_ms          integer,
    data_freshness      text,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT exchange_connection_health_state_check CHECK (state IN (
        'healthy', 'degraded', 'stale', 'reauth_required', 'unavailable', 'suspended', 'unknown'
    ))
);

-- -----------------------------------------------------------------------------
-- exchange_connection_events
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_connection_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exchange_connection_events_conn_idx ON exchange_connection_events (connection_id, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- exchange_request_metrics
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_request_metrics (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_code   text NOT NULL,
    connection_id   uuid REFERENCES exchange_connections(id) ON DELETE SET NULL,
    endpoint        text NOT NULL,
    method          text NOT NULL,
    status_code     integer,
    latency_ms      integer NOT NULL,
    error_class     text,
    recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exchange_request_metrics_exchange_idx ON exchange_request_metrics (exchange_code, recorded_at DESC);

-- -----------------------------------------------------------------------------
-- exchange_rate_limit_state
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_rate_limit_state (
    exchange_code   text PRIMARY KEY,
    window_start    timestamptz NOT NULL DEFAULT now(),
    request_count   integer NOT NULL DEFAULT 0,
    limit_remaining integer,
    reset_at        timestamptz,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- exchange_stream_sessions
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_stream_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    stream_type     text NOT NULL,
    status          text NOT NULL DEFAULT 'disconnected',
    last_message_at timestamptz,
    reconnect_count integer NOT NULL DEFAULT 0,
    metadata        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- exchange_sync_jobs
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_sync_jobs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    job_type        text NOT NULL,
    status          text NOT NULL DEFAULT 'pending',
    started_at      timestamptz,
    completed_at    timestamptz,
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exchange_sync_jobs_connection_idx ON exchange_sync_jobs (connection_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- exchange_reconciliation_events
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_reconciliation_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
    account_id      uuid REFERENCES exchange_accounts(id) ON DELETE SET NULL,
    category        text NOT NULL,
    details         jsonb NOT NULL,
    resolved_at     timestamptz,
    resolution      jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- exchange_adapter_incidents
-- -----------------------------------------------------------------------------
CREATE TABLE exchange_adapter_incidents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_code   text NOT NULL REFERENCES exchange_registry(exchange_code) ON DELETE CASCADE,
    severity        text NOT NULL,
    title           text NOT NULL,
    description     text,
    started_at      timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz,
    CONSTRAINT exchange_adapter_incidents_severity_check CHECK (severity IN ('info', 'warning', 'high', 'critical'))
);