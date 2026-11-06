-- =============================================================================
-- 057_email_delivery.sql
-- Transactional email delivery records + provider webhook events
-- =============================================================================

-- -----------------------------------------------------------------------------
-- email_deliveries
--
-- One row per outbound email request. Tracks the full lifecycle:
--   requested → accepted by provider → delivery outcome via webhook.
-- Raw verification tokens and API secrets are NEVER stored here.
-- -----------------------------------------------------------------------------
CREATE TABLE email_deliveries (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid REFERENCES users(id) ON DELETE SET NULL,
    recipient_email     text NOT NULL,
    email_type          text NOT NULL,
    subject             text,
    provider            text NOT NULL DEFAULT 'unknown',
    provider_message_id text,
    request_status      text NOT NULL DEFAULT 'pending'
                        CHECK (request_status IN ('pending', 'accepted', 'failed', 'skipped')),
    delivery_status     text NOT NULL DEFAULT 'unknown'
                        CHECK (delivery_status IN (
                            'unknown', 'queued', 'sent', 'delivered',
                            'delayed', 'bounced', 'complained', 'failed', 'suppressed'
                        )),
    failure_reason      text,
    error_category      text,
    metadata            jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_deliveries_user_idx ON email_deliveries (user_id);
CREATE INDEX email_deliveries_recipient_idx ON email_deliveries (recipient_email);
CREATE INDEX email_deliveries_type_idx ON email_deliveries (email_type);
CREATE INDEX email_deliveries_provider_message_idx ON email_deliveries (provider_message_id)
    WHERE provider_message_id IS NOT NULL;
CREATE INDEX email_deliveries_status_idx ON email_deliveries (request_status, delivery_status);
CREATE INDEX email_deliveries_created_idx ON email_deliveries (created_at DESC);

-- -----------------------------------------------------------------------------
-- email_webhook_events
--
-- Deduplication + audit trail for provider webhook events (Resend/Svix).
-- -----------------------------------------------------------------------------
CREATE TABLE email_webhook_events (
    provider_event_id   text PRIMARY KEY,
    provider            text NOT NULL,
    event_type          text NOT NULL,
    provider_message_id text,
    payload             jsonb NOT NULL,
    processed_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_webhook_events_message_idx ON email_webhook_events (provider_message_id)
    WHERE provider_message_id IS NOT NULL;
CREATE INDEX email_webhook_events_processed_idx ON email_webhook_events (processed_at DESC);

-- -----------------------------------------------------------------------------
-- user_passkeys
--
-- WebAuthn credentials. Only public material is stored; the private key
-- never leaves the user's device.
-- -----------------------------------------------------------------------------
CREATE TABLE user_passkeys (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              text NOT NULL DEFAULT 'Passkey',
    credential_id     text NOT NULL UNIQUE,
    public_key        bytea NOT NULL,
    attestation_type  text,
    transports        jsonb,
    sign_count        bigint NOT NULL DEFAULT 0,
    device_type       text,
    backed_up         boolean,
    registered_ip     inet,
    user_agent        text,
    last_used_at      timestamptz,
    revoked_at        timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_passkeys_user_idx ON user_passkeys (user_id) WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- webauthn_challenges
--
-- Single-use, expiring challenges for registration and authentication
-- ceremonies. The raw challenge is stored hashed.
-- -----------------------------------------------------------------------------
CREATE TABLE webauthn_challenges (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
    ceremony     text NOT NULL CHECK (ceremony IN (
                     'registration', 'authentication', 'discoverable_authentication'
                 )),
    challenge    text NOT NULL UNIQUE,
    expires_at   timestamptz NOT NULL,
    consumed_at  timestamptz,
    ip_address   inet,
    user_agent   text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX webauthn_challenges_user_idx ON webauthn_challenges (user_id)
    WHERE consumed_at IS NULL;
CREATE INDEX webauthn_challenges_expiry_idx ON webauthn_challenges (expires_at)
    WHERE consumed_at IS NULL;
