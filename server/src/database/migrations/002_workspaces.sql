-- =============================================================================
-- 002_workspaces.sql
-- Module 03 — Workspaces, Teams and Permissions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- workspaces
-- -----------------------------------------------------------------------------
CREATE TABLE workspaces (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  text NOT NULL,
    type                  text NOT NULL,
    status                text NOT NULL DEFAULT 'active',
    owner_id              uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    description           text,
    timezone              text NOT NULL DEFAULT 'UTC',
    preferred_language    text NOT NULL DEFAULT 'en',
    settings              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    closed_at             timestamptz,
    CONSTRAINT workspaces_type_check CHECK (type IN ('personal', 'organization')),
    CONSTRAINT workspaces_status_check CHECK (status IN ('active', 'suspended', 'pending_closure', 'closed'))
);

CREATE INDEX workspaces_owner_id_idx ON workspaces (owner_id);
CREATE INDEX workspaces_type_status_idx ON workspaces (type, status);
CREATE UNIQUE INDEX workspaces_personal_unique ON workspaces (owner_id) WHERE type = 'personal';

CREATE TRIGGER workspaces_set_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- workspace_roles (per-workspace configurable roles)
-- -----------------------------------------------------------------------------
CREATE TABLE workspace_roles (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name           text NOT NULL,
    description    text,
    permissions    text[] NOT NULL DEFAULT '{}',
    is_system      boolean NOT NULL DEFAULT false,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, name)
);

-- -----------------------------------------------------------------------------
-- workspace_memberships
-- -----------------------------------------------------------------------------
CREATE TABLE workspace_memberships (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                  text NOT NULL,
    status                text NOT NULL DEFAULT 'active',
    extra_permissions     text[] NOT NULL DEFAULT '{}',
    invited_by            uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    removed_at            timestamptz,
    CONSTRAINT workspace_memberships_role_check CHECK (role IN (
        'owner', 'administrator', 'trading_operator', 'analyst', 'viewer'
    )),
    CONSTRAINT workspace_memberships_status_check CHECK (status IN (
        'invited', 'active', 'suspended', 'removed', 'ownership_transfer_pending'
    ))
);

CREATE UNIQUE INDEX workspace_memberships_unique ON workspace_memberships (workspace_id, user_id);
CREATE INDEX workspace_memberships_user_id_idx ON workspace_memberships (user_id) WHERE status = 'active';
CREATE INDEX workspace_memberships_workspace_id_idx ON workspace_memberships (workspace_id) WHERE status = 'active';

CREATE TRIGGER workspace_memberships_set_updated_at BEFORE UPDATE ON workspace_memberships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- workspace_invitations
-- -----------------------------------------------------------------------------
CREATE TABLE workspace_invitations (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email          text NOT NULL,
    email_normalized text NOT NULL,
    role           text NOT NULL,
    token_hash     text NOT NULL,
    invited_by     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status         text NOT NULL DEFAULT 'pending',
    created_at     timestamptz NOT NULL DEFAULT now(),
    expires_at     timestamptz NOT NULL,
    accepted_at    timestamptz,
    revoked_at     timestamptz,
    CONSTRAINT workspace_invitations_role_check CHECK (role IN (
        'administrator', 'trading_operator', 'analyst', 'viewer'
    )),
    CONSTRAINT workspace_invitations_status_check CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

CREATE UNIQUE INDEX workspace_invitations_token_hash_unique ON workspace_invitations (token_hash);
CREATE INDEX workspace_invitations_workspace_id_idx ON workspace_invitations (workspace_id, status);
CREATE UNIQUE INDEX workspace_invitations_active_unique ON workspace_invitations (workspace_id, email_normalized)
    WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- connection_sharing_grants
-- -----------------------------------------------------------------------------
CREATE TABLE connection_sharing_grants (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id         uuid NOT NULL,
    home_workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    recipient_workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    allowed_operations    text[] NOT NULL,
    status                text NOT NULL DEFAULT 'pending',
    granted_by            uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by           uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    approved_at           timestamptz,
    expires_at            timestamptz,
    revoked_at            timestamptz,
    CONSTRAINT connection_sharing_grants_status_check CHECK (status IN ('pending', 'active', 'revoked', 'expired'))
);

CREATE INDEX connection_sharing_grants_connection_id_idx ON connection_sharing_grants (connection_id);
CREATE INDEX connection_sharing_grants_recipient_ws_idx ON connection_sharing_grants (recipient_workspace_id)
    WHERE status = 'active';
CREATE INDEX connection_sharing_grants_home_ws_idx ON connection_sharing_grants (home_workspace_id);

-- -----------------------------------------------------------------------------
-- workspace_ownership_transfers
-- -----------------------------------------------------------------------------
CREATE TABLE workspace_ownership_transfers (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    from_user_id      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    to_user_id        uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status            text NOT NULL DEFAULT 'pending',
    reason            text NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    expires_at        timestamptz NOT NULL,
    accepted_at       timestamptz,
    canceled_at       timestamptz,
    CONSTRAINT workspace_ownership_transfers_status_check CHECK (status IN ('pending', 'accepted', 'canceled', 'expired'))
);

CREATE INDEX workspace_ownership_transfers_workspace_id_idx ON workspace_ownership_transfers (workspace_id, status);

-- -----------------------------------------------------------------------------
-- workspace_audit_events
-- -----------------------------------------------------------------------------
CREATE TABLE workspace_audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    event_type      text NOT NULL,
    target_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    target_resource text,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workspace_audit_events_workspace_id_idx ON workspace_audit_events (workspace_id, occurred_at DESC);