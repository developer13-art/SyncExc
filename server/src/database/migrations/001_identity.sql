-- =============================================================================
-- 001_identity.sql
-- Module 01 — Identity and Account Security
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email                 text NOT NULL,
    email_normalized      text NOT NULL,
    email_verified_at     timestamptz,
    password_hash         text,
    username              text NOT NULL,
    username_normalized   text NOT NULL,
    display_name          text NOT NULL,
    avatar_url            text,
    preferred_language    text NOT NULL DEFAULT 'en',
    timezone              text NOT NULL DEFAULT 'UTC',
    country_code          char(2),
    status                text NOT NULL DEFAULT 'pending_verification',
    terms_version         text,
    terms_accepted_at     timestamptz,
    privacy_version       text,
    privacy_accepted_at   timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    deleted_at            timestamptz,
    CONSTRAINT users_email_format CHECK (email_normalized ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT users_username_format CHECK (username_normalized ~ '^[a-z0-9_][a-z0-9_-]{1,30}[a-z0-9_]$'),
    CONSTRAINT users_status_check CHECK (status IN (
        'pending_verification', 'active', 'temporarily_restricted',
        'suspended', 'deletion_pending', 'deleted'
    ))
);

CREATE UNIQUE INDEX users_email_normalized_unique ON users (email_normalized) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX users_username_normalized_unique ON users (username_normalized) WHERE deleted_at IS NULL;
CREATE INDEX users_status_idx ON users (status) WHERE deleted_at IS NULL;
CREATE INDEX users_created_at_idx ON users (created_at);

-- -----------------------------------------------------------------------------
-- user_auth_methods
-- -----------------------------------------------------------------------------
CREATE TABLE user_auth_methods (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method_type   text NOT NULL,
    identifier    text,
    status        text NOT NULL DEFAULT 'active',
    metadata      jsonb,
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_used_at  timestamptz,
    revoked_at    timestamptz,
    CONSTRAINT user_auth_methods_type_check CHECK (method_type IN ('password', 'google', 'github')),
    CONSTRAINT user_auth_methods_status_check CHECK (status IN ('active', 'pending', 'revoked'))
);

CREATE INDEX user_auth_methods_user_id_idx ON user_auth_methods (user_id);
CREATE UNIQUE INDEX user_auth_methods_identifier_unique
    ON user_auth_methods (method_type, identifier)
    WHERE identifier IS NOT NULL AND status = 'active';

-- -----------------------------------------------------------------------------
-- user_security_settings
-- -----------------------------------------------------------------------------
CREATE TABLE user_security_settings (
    user_id                       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mfa_enabled_at                timestamptz,
    mfa_secret_encrypted          text,
    mfa_secret_pending_encrypted  text,
    mfa_recovery_codes_generated_at timestamptz,
    password_changed_at           timestamptz,
    security_settings_updated_at  timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- user_sessions
-- -----------------------------------------------------------------------------
CREATE TABLE user_sessions (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash    text NOT NULL,
    device_id             uuid,
    device_label          text,
    ip_address            text,
    user_agent            text,
    step_up_at            timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now(),
    last_activity_at      timestamptz NOT NULL DEFAULT now(),
    expires_at            timestamptz NOT NULL,
    revoked_at            timestamptz
);

CREATE UNIQUE INDEX user_sessions_token_hash_unique ON user_sessions (session_token_hash);
CREATE INDEX user_sessions_user_id_idx ON user_sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX user_sessions_expires_at_idx ON user_sessions (expires_at) WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- auth_challenges
-- -----------------------------------------------------------------------------
CREATE TABLE auth_challenges (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
    email         text,
    challenge_type text NOT NULL,
    token_hash    text NOT NULL,
    code_hash     text,
    salt          text,
    attempt_count integer NOT NULL DEFAULT 0,
    metadata      jsonb,
    created_at    timestamptz NOT NULL DEFAULT now(),
    expires_at    timestamptz NOT NULL,
    consumed_at   timestamptz,
    CONSTRAINT auth_challenges_type_check CHECK (challenge_type IN (
        'email_verification', 'password_reset', 'mfa_verification',
        'email_change', 'phone_verification'
    ))
);

CREATE UNIQUE INDEX auth_challenges_token_hash_unique ON auth_challenges (token_hash);
CREATE INDEX auth_challenges_user_id_idx ON auth_challenges (user_id);
CREATE INDEX auth_challenges_email_idx ON auth_challenges (email) WHERE email IS NOT NULL;
CREATE INDEX auth_challenges_expires_at_idx ON auth_challenges (expires_at) WHERE consumed_at IS NULL;

-- -----------------------------------------------------------------------------
-- user_recovery_codes
-- -----------------------------------------------------------------------------
CREATE TABLE user_recovery_codes (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_verifier text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    used_at       timestamptz,
    revoked_at    timestamptz
);

CREATE INDEX user_recovery_codes_user_id_idx ON user_recovery_codes (user_id) WHERE revoked_at IS NULL AND used_at IS NULL;

-- -----------------------------------------------------------------------------
-- trusted_devices
-- -----------------------------------------------------------------------------
CREATE TABLE trusted_devices (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token_hash  text NOT NULL,
    device_label       text,
    user_agent         text,
    ip_address         text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    last_seen_at       timestamptz NOT NULL DEFAULT now(),
    expires_at         timestamptz NOT NULL,
    revoked_at         timestamptz
);

CREATE UNIQUE INDEX trusted_devices_token_hash_unique ON trusted_devices (device_token_hash);
CREATE INDEX trusted_devices_user_id_idx ON trusted_devices (user_id) WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- user_security_events
-- -----------------------------------------------------------------------------
CREATE TABLE user_security_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    event_type      text NOT NULL,
    outcome         text NOT NULL,
    ip_address      text,
    device_metadata jsonb,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_security_events_outcome_check CHECK (outcome IN ('success', 'failure', 'blocked'))
);

CREATE INDEX user_security_events_user_id_idx ON user_security_events (user_id, occurred_at DESC);
CREATE INDEX user_security_events_type_idx ON user_security_events (event_type, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- user_notification_preferences
-- -----------------------------------------------------------------------------
CREATE TABLE user_notification_preferences (
    user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type text NOT NULL,
    channel          text NOT NULL,
    enabled          boolean NOT NULL DEFAULT true,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, notification_type, channel)
);

-- -----------------------------------------------------------------------------
-- updated_at trigger helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();