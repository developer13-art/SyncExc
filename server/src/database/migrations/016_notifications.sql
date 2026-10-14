-- =============================================================================
-- 016_notifications.sql
-- Module 16 — Notifications and Alerts
-- =============================================================================

CREATE TABLE notification_event_types (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      text NOT NULL UNIQUE,
    category        text NOT NULL,
    default_priority text NOT NULL,
    default_channels text[] NOT NULL DEFAULT '{}',
    description     text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notification_event_types_priority_check CHECK (default_priority IN ('low', 'normal', 'high', 'critical'))
);

CREATE TABLE notification_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      text NOT NULL,
    schema_version  text NOT NULL,
    payload         jsonb NOT NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
    resource_type   text,
    resource_id     uuid,
    correlation_id  uuid,
    ingested_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notification_events_type_idx ON notification_events (event_type, ingested_at DESC);

CREATE TABLE notifications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id        uuid REFERENCES notification_events(id) ON DELETE SET NULL,
    event_type      text NOT NULL,
    category        text NOT NULL,
    priority        text NOT NULL,
    title           text NOT NULL,
    message         text NOT NULL,
    action          jsonb,
    status          text NOT NULL DEFAULT 'created',
    read_at         timestamptz,
    archived_at     timestamptz,
    expires_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notifications_priority_check CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    CONSTRAINT notifications_status_check CHECK (status IN (
        'created', 'queued', 'processing', 'delivered', 'read', 'archived', 'expired', 'canceled', 'failed'
    ))
);

CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON notifications (user_id) WHERE read_at IS NULL;

CREATE TABLE notification_recipients (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type   text,
    resource_id     uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (notification_id, user_id)
);

CREATE TABLE notification_deliveries (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel         text NOT NULL,
    state           text NOT NULL DEFAULT 'pending',
    attempt_count   integer NOT NULL DEFAULT 0,
    provider_ref    text,
    delivered_at    timestamptz,
    failure_reason  text,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notification_deliveries_channel_check CHECK (channel IN ('in_app', 'email', 'push')),
    CONSTRAINT notification_deliveries_state_check CHECK (state IN (
        'pending', 'sending', 'accepted', 'delivered', 'retry_scheduled',
        'failed', 'suppressed', 'expired', 'dead_lettered'
    ))
);

CREATE INDEX notification_deliveries_notification_idx ON notification_deliveries (notification_id);

CREATE TABLE notification_delivery_attempts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id     uuid NOT NULL REFERENCES notification_deliveries(id) ON DELETE CASCADE,
    attempt_number  integer NOT NULL,
    state           text NOT NULL,
    provider_ref    text,
    error_message   text,
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    UNIQUE (delivery_id, attempt_number)
);

CREATE TABLE notification_preferences (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type text NOT NULL,
    channel         text NOT NULL,
    enabled         boolean NOT NULL DEFAULT true,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, notification_type, channel)
);

CREATE TABLE notification_quiet_hours (
    user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled         boolean NOT NULL DEFAULT false,
    start_time      time,
    end_time        time,
    timezone        text NOT NULL DEFAULT 'UTC',
    days_of_week    integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_workspace_policies (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    category        text NOT NULL,
    channel         text NOT NULL,
    enabled         boolean NOT NULL DEFAULT true,
    policy          jsonb,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, category, channel)
);

CREATE TABLE notification_push_subscriptions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint        text NOT NULL,
    p256dh          text NOT NULL,
    auth            text NOT NULL,
    device_label    text,
    status          text NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_used_at    timestamptz,
    CONSTRAINT notification_push_subscriptions_status_check CHECK (status IN ('active', 'invalid', 'revoked'))
);

CREATE UNIQUE INDEX notification_push_subscriptions_endpoint_unique
    ON notification_push_subscriptions (endpoint);

CREATE TABLE notification_email_destinations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email           text NOT NULL,
    verified_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, email)
);

CREATE TABLE notification_templates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key             text NOT NULL UNIQUE,
    event_type      text NOT NULL,
    description     text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_template_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     uuid NOT NULL REFERENCES notification_templates(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    locale          text NOT NULL DEFAULT 'en',
    title_template  text NOT NULL,
    body_template   text NOT NULL,
    action_template jsonb,
    channels        text[] NOT NULL DEFAULT ARRAY['in_app', 'email'],
    published_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (template_id, version, locale)
);

CREATE TABLE notification_deduplication_keys (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key             text NOT NULL UNIQUE,
    notification_id uuid REFERENCES notifications(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_groups (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_key       text NOT NULL UNIQUE,
    category        text NOT NULL,
    priority        text NOT NULL,
    state           text NOT NULL DEFAULT 'open',
    first_event_at  timestamptz NOT NULL DEFAULT now(),
    latest_event_at timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz,
    CONSTRAINT notification_groups_state_check CHECK (state IN ('open', 'resolved'))
);

CREATE TABLE notification_escalation_policies (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category        text NOT NULL,
    priority        text NOT NULL,
    escalation_rules jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_escalation_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid REFERENCES notifications(id) ON DELETE SET NULL,
    policy_id       uuid REFERENCES notification_escalation_policies(id) ON DELETE SET NULL,
    outcome         text NOT NULL,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_digests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    digest_type     text NOT NULL,
    period_start    timestamptz NOT NULL,
    period_end      timestamptz NOT NULL,
    status          text NOT NULL DEFAULT 'pending',
    notification_ids uuid[] NOT NULL DEFAULT '{}',
    sent_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notification_digests_status_check CHECK (status IN ('pending', 'sent', 'failed'))
);

CREATE TABLE notification_provider_registry (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_key    text NOT NULL UNIQUE,
    channel         text NOT NULL,
    status          text NOT NULL DEFAULT 'active',
    metadata        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_provider_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_key    text NOT NULL,
    event_type      text NOT NULL,
    payload         jsonb NOT NULL,
    processed_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_suppression_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    notification_id uuid REFERENCES notifications(id) ON DELETE SET NULL,
    reason          text NOT NULL,
    policy_ref      text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    action          text NOT NULL,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    before          jsonb,
    after           jsonb,
    outcome         text NOT NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_usage_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
    channel         text NOT NULL,
    amount          bigint NOT NULL DEFAULT 1,
    recorded_at     timestamptz NOT NULL DEFAULT now()
);