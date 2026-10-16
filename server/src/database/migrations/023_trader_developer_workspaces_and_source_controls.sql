-- Add type-specific personal workspaces and safe signal-source execution controls.

ALTER TABLE workspaces
  DROP CONSTRAINT IF EXISTS workspaces_type_check,
  DROP CONSTRAINT IF EXISTS workspaces_status_check;

ALTER TABLE workspaces
  ADD CONSTRAINT workspaces_type_check
    CHECK (type IN ('personal', 'organization', 'trader', 'developer')),
  ADD CONSTRAINT workspaces_status_check
    CHECK (status IN ('active', 'paused', 'suspended', 'restricted', 'pending_closure', 'archived', 'closed'));

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT workspaces_visibility_check CHECK (visibility IN ('private', 'unlisted', 'public'));

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_owner_type_slug_unique
  ON workspaces (owner_id, type, slug)
  WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS workspace_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  previous_status text,
  next_status text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_lifecycle_events_workspace_idx
  ON workspace_lifecycle_events (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS workspace_capability_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  capability_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'workspace_owner',
  granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, capability_key),
  CONSTRAINT workspace_capability_source_check CHECK (
    source IN ('workspace_owner', 'plan_entitlement', 'platform_policy', 'admin_override')
  )
);

-- A provider profile is attached to a Trader workspace, rather than being a
-- single profile for the user's entire account. Existing profiles remain valid.
ALTER TABLE marketplace_provider_profiles
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD CONSTRAINT marketplace_provider_profiles_visibility_check
    CHECK (visibility IN ('private', 'unlisted', 'public'));

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_provider_profiles_workspace_unique
  ON marketplace_provider_profiles (workspace_id)
  WHERE workspace_id IS NOT NULL;

-- Monitoring is opt-in for every individual source. Execution settings are
-- immutable by version and destination accounts are explicitly selected.
ALTER TABLE signal_sources
  ADD COLUMN IF NOT EXISTS monitoring_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monitoring_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_config_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS execution_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_monitor_error text;

CREATE TABLE IF NOT EXISTS telegram_bot_update_cursors (
  bot_fingerprint text PRIMARY KEY,
  update_offset bigint NOT NULL DEFAULT 0,
  lease_owner text,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signal_source_execution_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version integer NOT NULL,
  mode text NOT NULL DEFAULT 'review',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, version),
  CONSTRAINT signal_source_execution_configs_mode_check
    CHECK (mode IN ('monitor_only', 'review', 'simulate', 'live'))
);

CREATE INDEX IF NOT EXISTS signal_source_execution_configs_workspace_idx
  ON signal_source_execution_configs (workspace_id, source_id, version DESC);

CREATE TABLE IF NOT EXISTS signal_source_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES signal_sources(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, account_id)
);

CREATE INDEX IF NOT EXISTS signal_source_destinations_workspace_idx
  ON signal_source_destinations (workspace_id, source_id, enabled);

CREATE TABLE IF NOT EXISTS trading_execution_destination_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL REFERENCES trading_execution_intents(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trading_execution_destination_results_status_check
    CHECK (status IN ('pending', 'submitted', 'succeeded', 'failed', 'uncertain', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS trading_execution_destination_results_intent_idx
  ON trading_execution_destination_results (intent_id, created_at);
