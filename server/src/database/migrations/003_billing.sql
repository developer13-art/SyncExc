-- =============================================================================
-- 003_billing.sql
-- Module 02 — Subscription, Billing and Entitlements
-- =============================================================================

-- -----------------------------------------------------------------------------
-- subscription_plans
-- -----------------------------------------------------------------------------
CREATE TABLE subscription_plans (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code         text NOT NULL UNIQUE,
    name         text NOT NULL,
    description  text,
    status       text NOT NULL DEFAULT 'draft',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT subscription_plans_status_check CHECK (status IN ('draft', 'active', 'retired', 'archived'))
);

CREATE TRIGGER subscription_plans_set_updated_at BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- subscription_plan_versions
-- -----------------------------------------------------------------------------
CREATE TABLE subscription_plan_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    version_number  integer NOT NULL,
    features        jsonb NOT NULL DEFAULT '{}'::jsonb,
    limits          jsonb NOT NULL DEFAULT '{}'::jsonb,
    availability    jsonb NOT NULL DEFAULT '{}'::jsonb,
    effective_from  timestamptz NOT NULL DEFAULT now(),
    effective_until timestamptz,
    published_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id, version_number)
);

CREATE INDEX subscription_plan_versions_plan_id_idx ON subscription_plan_versions (plan_id);

-- -----------------------------------------------------------------------------
-- subscription_plan_prices
-- -----------------------------------------------------------------------------
CREATE TABLE subscription_plan_prices (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_version_id       uuid NOT NULL REFERENCES subscription_plan_versions(id) ON DELETE CASCADE,
    currency              text NOT NULL,
    amount_minor          bigint NOT NULL,
    billing_interval      text NOT NULL DEFAULT 'monthly',
    provider_price_reference text,
    effective_from        timestamptz NOT NULL DEFAULT now(),
    effective_until       timestamptz,
    CONSTRAINT subscription_plan_prices_interval_check CHECK (billing_interval IN ('monthly', 'yearly'))
);

CREATE INDEX subscription_plan_prices_version_id_idx ON subscription_plan_prices (plan_version_id);

-- -----------------------------------------------------------------------------
-- subscriptions
-- -----------------------------------------------------------------------------
CREATE TABLE subscriptions (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_scope_type        text NOT NULL,
    billing_scope_id          uuid NOT NULL,
    plan_version_id           uuid NOT NULL REFERENCES subscription_plan_versions(id),
    plan_price_id             uuid NOT NULL REFERENCES subscription_plan_prices(id),
    status                    text NOT NULL DEFAULT 'pending',
    current_period_start      timestamptz NOT NULL DEFAULT now(),
    current_period_end        timestamptz NOT NULL,
    next_billing_at           timestamptz,
    cancel_at_period_end      boolean NOT NULL DEFAULT false,
    canceled_at               timestamptz,
    ended_at                  timestamptz,
    provider_subscription_reference text,
    metadata                  jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT subscriptions_scope_type_check CHECK (billing_scope_type IN ('user', 'workspace')),
    CONSTRAINT subscriptions_status_check CHECK (status IN (
        'pending', 'trialing', 'active', 'past_due', 'grace_period',
        'cancel_scheduled', 'canceled', 'expired', 'suspended'
    ))
);

CREATE INDEX subscriptions_scope_idx ON subscriptions (billing_scope_type, billing_scope_id);
CREATE UNIQUE INDEX subscriptions_active_unique ON subscriptions (billing_scope_type, billing_scope_id)
    WHERE status IN ('active', 'trialing', 'past_due', 'grace_period', 'cancel_scheduled');

CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- subscription_changes
-- -----------------------------------------------------------------------------
CREATE TABLE subscription_changes (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id           uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    previous_plan_version_id  uuid REFERENCES subscription_plan_versions(id),
    new_plan_version_id       uuid NOT NULL REFERENCES subscription_plan_versions(id),
    effective_at              timestamptz NOT NULL,
    proration_amount_minor    bigint,
    currency                  text,
    status                    text NOT NULL DEFAULT 'pending',
    reason                    text,
    created_at                timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT subscription_changes_status_check CHECK (status IN ('pending', 'applied', 'failed', 'canceled'))
);

CREATE INDEX subscription_changes_subscription_id_idx ON subscription_changes (subscription_id);

-- -----------------------------------------------------------------------------
-- checkout_sessions
-- -----------------------------------------------------------------------------
CREATE TABLE checkout_sessions (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_scope_type       text NOT NULL,
    billing_scope_id         uuid NOT NULL,
    plan_price_id            uuid NOT NULL REFERENCES subscription_plan_prices(id),
    provider                 text NOT NULL,
    provider_checkout_reference text,
    amount_minor             bigint NOT NULL,
    currency                 text NOT NULL,
    status                   text NOT NULL DEFAULT 'pending',
    success_url              text,
    cancel_url               text,
    metadata                 jsonb,
    created_at               timestamptz NOT NULL DEFAULT now(),
    expires_at               timestamptz NOT NULL,
    completed_at             timestamptz,
    CONSTRAINT checkout_sessions_provider_check CHECK (provider IN ('stripe', 'paystack', 'flutterwave')),
    CONSTRAINT checkout_sessions_status_check CHECK (status IN ('pending', 'completed', 'failed', 'canceled', 'expired'))
);

CREATE INDEX checkout_sessions_scope_idx ON checkout_sessions (billing_scope_type, billing_scope_id);

-- -----------------------------------------------------------------------------
-- subscription_payments
-- -----------------------------------------------------------------------------
CREATE TABLE subscription_payments (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id           uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
    checkout_session_id       uuid REFERENCES checkout_sessions(id) ON DELETE SET NULL,
    provider                  text NOT NULL,
    provider_payment_reference text,
    amount_minor              bigint NOT NULL,
    currency                  text NOT NULL,
    status                    text NOT NULL DEFAULT 'pending',
    failure_reason            text,
    metadata                  jsonb,
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now(),
    paid_at                   timestamptz,
    CONSTRAINT subscription_payments_status_check CHECK (status IN (
        'pending', 'succeeded', 'failed', 'partially_refunded', 'refunded'
    ))
);

CREATE UNIQUE INDEX subscription_payments_provider_ref_unique
    ON subscription_payments (provider, provider_payment_reference)
    WHERE provider_payment_reference IS NOT NULL;
CREATE INDEX subscription_payments_subscription_id_idx ON subscription_payments (subscription_id);

CREATE TRIGGER subscription_payments_set_updated_at BEFORE UPDATE ON subscription_payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- payment_webhook_events
-- -----------------------------------------------------------------------------
CREATE TABLE payment_webhook_events (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider         text NOT NULL,
    provider_event_id text NOT NULL,
    event_type       text NOT NULL,
    payload          jsonb NOT NULL,
    status           text NOT NULL DEFAULT 'pending',
    processed_at     timestamptz,
    error_message    text,
    received_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT payment_webhook_events_status_check CHECK (status IN ('pending', 'processed', 'failed', 'ignored'))
);

CREATE UNIQUE INDEX payment_webhook_events_provider_event_unique
    ON payment_webhook_events (provider, provider_event_id);

-- -----------------------------------------------------------------------------
-- billing_invoices
-- -----------------------------------------------------------------------------
CREATE TABLE billing_invoices (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    number          text NOT NULL UNIQUE,
    subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
    billing_scope_type text NOT NULL,
    billing_scope_id uuid NOT NULL,
    status          text NOT NULL DEFAULT 'draft',
    amount_minor    bigint NOT NULL,
    currency        text NOT NULL,
    line_items      jsonb NOT NULL DEFAULT '[]'::jsonb,
    seller_details  jsonb NOT NULL DEFAULT '{}'::jsonb,
    customer_details jsonb NOT NULL DEFAULT '{}'::jsonb,
    issued_at       timestamptz,
    due_at          timestamptz,
    paid_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT billing_invoices_status_check CHECK (status IN ('draft', 'issued', 'paid', 'void', 'refunded'))
);

CREATE INDEX billing_invoices_scope_idx ON billing_invoices (billing_scope_type, billing_scope_id, issued_at DESC);

-- -----------------------------------------------------------------------------
-- refund_records
-- -----------------------------------------------------------------------------
CREATE TABLE refund_records (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id            uuid NOT NULL REFERENCES subscription_payments(id) ON DELETE RESTRICT,
    amount_minor          bigint NOT NULL,
    currency              text NOT NULL,
    reason                text NOT NULL,
    status                text NOT NULL DEFAULT 'requested',
    provider_refund_reference text,
    requested_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    decided_by            uuid REFERENCES users(id) ON DELETE SET NULL,
    decision_reason       text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    decided_at            timestamptz,
    completed_at          timestamptz,
    CONSTRAINT refund_records_status_check CHECK (status IN (
        'requested', 'under_review', 'approved', 'processing', 'completed',
        'rejected', 'failed', 'canceled'
    ))
);

CREATE INDEX refund_records_payment_id_idx ON refund_records (payment_id);

-- -----------------------------------------------------------------------------
-- payment_disputes
-- -----------------------------------------------------------------------------
CREATE TABLE payment_disputes (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id               uuid NOT NULL REFERENCES subscription_payments(id) ON DELETE RESTRICT,
    provider_dispute_id      text NOT NULL,
    amount_minor             bigint NOT NULL,
    currency                 text NOT NULL,
    status                   text NOT NULL DEFAULT 'received',
    deadline_at              timestamptz,
    evidence                 jsonb,
    outcome                  text,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    closed_at                timestamptz,
    CONSTRAINT payment_disputes_status_check CHECK (status IN ('received', 'under_review', 'won', 'lost', 'closed'))
);

CREATE UNIQUE INDEX payment_disputes_provider_dispute_unique
    ON payment_disputes (provider_dispute_id);

-- -----------------------------------------------------------------------------
-- subscription_entitlements
-- -----------------------------------------------------------------------------
CREATE TABLE subscription_entitlements (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_scope_type text NOT NULL,
    billing_scope_id   uuid NOT NULL,
    subscription_id    uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
    feature_key        text NOT NULL,
    value              jsonb NOT NULL,
    source_type        text NOT NULL DEFAULT 'subscription',
    valid_from         timestamptz NOT NULL DEFAULT now(),
    valid_until        timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now(),
    revoked_at         timestamptz,
    CONSTRAINT subscription_entitlements_source_check CHECK (source_type IN ('subscription', 'promotion', 'override'))
);

CREATE INDEX subscription_entitlements_scope_idx
    ON subscription_entitlements (billing_scope_type, billing_scope_id, feature_key)
    WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- subscription_usage_counters
-- -----------------------------------------------------------------------------
CREATE TABLE subscription_usage_counters (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_scope_type text NOT NULL,
    billing_scope_id   uuid NOT NULL,
    usage_dimension    text NOT NULL,
    period_start       timestamptz NOT NULL,
    period_end         timestamptz NOT NULL,
    current_value      bigint NOT NULL DEFAULT 0,
    updated_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (billing_scope_type, billing_scope_id, usage_dimension, period_start)
);

-- -----------------------------------------------------------------------------
-- subscription_usage_events
-- -----------------------------------------------------------------------------
CREATE TABLE subscription_usage_events (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id           text NOT NULL UNIQUE,
    billing_scope_type text NOT NULL,
    billing_scope_id   uuid NOT NULL,
    usage_dimension    text NOT NULL,
    amount             bigint NOT NULL,
    resource_ref       text,
    metadata           jsonb,
    occurred_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscription_usage_events_scope_idx
    ON subscription_usage_events (billing_scope_type, billing_scope_id, usage_dimension, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- billing_adjustments
-- -----------------------------------------------------------------------------
CREATE TABLE billing_adjustments (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_scope_type    text NOT NULL,
    billing_scope_id      uuid NOT NULL,
    payment_id            uuid REFERENCES subscription_payments(id) ON DELETE SET NULL,
    amount_minor          bigint NOT NULL,
    currency              text NOT NULL,
    type                  text NOT NULL,
    reason                text NOT NULL,
    created_by            uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT billing_adjustments_type_check CHECK (type IN ('credit', 'correction', 'discount', 'write_off'))
);

-- -----------------------------------------------------------------------------
-- billing_ledger_entries (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE billing_ledger_entries (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_scope_type    text NOT NULL,
    billing_scope_id      uuid NOT NULL,
    entry_type            text NOT NULL,
    amount_minor          bigint NOT NULL,
    currency              text NOT NULL,
    source_type           text,
    source_id             uuid,
    metadata              jsonb,
    created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX billing_ledger_scope_idx ON billing_ledger_entries (billing_scope_type, billing_scope_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- billing_audit_events
-- -----------------------------------------------------------------------------
CREATE TABLE billing_audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    billing_scope_type text,
    billing_scope_id uuid,
    action          text NOT NULL,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    before          jsonb,
    after           jsonb,
    outcome         text NOT NULL,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX billing_audit_events_scope_idx ON billing_audit_events (billing_scope_type, billing_scope_id, occurred_at DESC);