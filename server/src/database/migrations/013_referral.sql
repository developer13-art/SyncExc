-- =============================================================================
-- 013_referral.sql
-- Module 13 — Referral and Commission System
-- =============================================================================

-- -----------------------------------------------------------------------------
-- affiliates
-- -----------------------------------------------------------------------------
CREATE TABLE affiliates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'not_enrolled',
    payout_currency text NOT NULL DEFAULT 'USD',
    enrolled_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT affiliates_status_check CHECK (status IN (
        'not_enrolled', 'application_pending', 'active', 'restricted', 'suspended', 'terminated'
    ))
);

CREATE TRIGGER affiliates_set_updated_at BEFORE UPDATE ON affiliates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- affiliate_agreements
-- -----------------------------------------------------------------------------
CREATE TABLE affiliate_agreements (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    version         text NOT NULL,
    accepted_at     timestamptz NOT NULL DEFAULT now(),
    ip_address      text,
    user_agent      text,
    UNIQUE (affiliate_id, version)
);

-- -----------------------------------------------------------------------------
-- affiliate_referral_links
-- -----------------------------------------------------------------------------
CREATE TABLE affiliate_referral_links (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    code            text NOT NULL UNIQUE,
    name            text NOT NULL,
    campaign_label  text,
    tracking_params jsonb,
    status          text NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now(),
    paused_at       timestamptz,
    expired_at      timestamptz,
    revoked_at      timestamptz,
    CONSTRAINT affiliate_referral_links_status_check CHECK (status IN ('active', 'paused', 'expired', 'revoked'))
);

CREATE INDEX affiliate_referral_links_affiliate_idx ON affiliate_referral_links (affiliate_id, status);

-- -----------------------------------------------------------------------------
-- affiliate_campaigns
-- -----------------------------------------------------------------------------
CREATE TABLE affiliate_campaigns (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    name            text NOT NULL,
    attribution_rules jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- referral_click_events
-- -----------------------------------------------------------------------------
CREATE TABLE referral_click_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id         uuid NOT NULL REFERENCES affiliate_referral_links(id) ON DELETE CASCADE,
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    session_ref     text,
    ip_address      text,
    user_agent      text,
    referrer        text,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX referral_click_events_link_idx ON referral_click_events (link_id, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- referral_attributions
-- -----------------------------------------------------------------------------
CREATE TABLE referral_attributions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE RESTRICT,
    link_id         uuid REFERENCES affiliate_referral_links(id) ON DELETE SET NULL,
    referred_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state           text NOT NULL DEFAULT 'pending_registration',
    policy_version  text NOT NULL,
    click_event_id  uuid REFERENCES referral_click_events(id) ON DELETE SET NULL,
    first_attributed_at timestamptz,
    converted_at    timestamptz,
    revoked_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT referral_attributions_state_check CHECK (state IN (
        'pending_registration', 'attributed', 'converted', 'ineligible', 'disputed', 'revoked'
    ))
);

CREATE UNIQUE INDEX referral_attributions_referred_user_unique ON referral_attributions (referred_user_id)
    WHERE state = 'attributed';

CREATE INDEX referral_attributions_affiliate_idx ON referral_attributions (affiliate_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- referral_attribution_events
-- -----------------------------------------------------------------------------
CREATE TABLE referral_attribution_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attribution_id  uuid NOT NULL REFERENCES referral_attributions(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    reason          text,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- commission_policies
-- -----------------------------------------------------------------------------
CREATE TABLE commission_policies (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    status          text NOT NULL DEFAULT 'draft',
    current_version integer NOT NULL DEFAULT 1,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT commission_policies_status_check CHECK (status IN ('draft', 'active', 'retired', 'archived'))
);

CREATE TRIGGER commission_policies_set_updated_at BEFORE UPDATE ON commission_policies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- commission_policy_versions
-- -----------------------------------------------------------------------------
CREATE TABLE commission_policy_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id       uuid NOT NULL REFERENCES commission_policies(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    config          jsonb NOT NULL,
    effective_from  timestamptz NOT NULL,
    effective_until timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (policy_id, version)
);

-- -----------------------------------------------------------------------------
-- commission_eligibility_rules
-- -----------------------------------------------------------------------------
CREATE TABLE commission_eligibility_rules (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_version_id uuid NOT NULL REFERENCES commission_policy_versions(id) ON DELETE CASCADE,
    rule_type       text NOT NULL,
    config          jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- commission_accruals
-- -----------------------------------------------------------------------------
CREATE TABLE commission_accruals (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE RESTRICT,
    attribution_id  uuid NOT NULL REFERENCES referral_attributions(id) ON DELETE RESTRICT,
    payment_id      uuid NOT NULL REFERENCES subscription_payments(id) ON DELETE RESTRICT,
    policy_version_id uuid NOT NULL REFERENCES commission_policy_versions(id),
    type            text NOT NULL,
    state           text NOT NULL DEFAULT 'accumulated',
    amount_minor    bigint NOT NULL,
    currency        text NOT NULL,
    hold_until      timestamptz,
    accrued_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT commission_accruals_type_check CHECK (type IN ('first_payment', 'recurring')),
    CONSTRAINT commission_accruals_state_check CHECK (state IN (
        'accumulated', 'approved', 'held', 'released', 'adjusted', 'reversed'
    ))
);

CREATE INDEX commission_accruals_affiliate_idx ON commission_accruals (affiliate_id, accrued_at DESC);
CREATE UNIQUE INDEX commission_accruals_unique ON commission_accruals (payment_id, type);

-- -----------------------------------------------------------------------------
-- commission_ledger_entries (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE commission_ledger_entries (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE RESTRICT,
    accrual_id      uuid REFERENCES commission_accruals(id) ON DELETE SET NULL,
    entry_type      text NOT NULL,
    amount_minor    bigint NOT NULL,
    currency        text NOT NULL,
    source_type     text,
    source_id       uuid,
    metadata        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX commission_ledger_entries_affiliate_idx ON commission_ledger_entries (affiliate_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- commission_holds
-- -----------------------------------------------------------------------------
CREATE TABLE commission_holds (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    accrual_id      uuid REFERENCES commission_accruals(id) ON DELETE CASCADE,
    reason          text NOT NULL,
    release_condition text,
    released_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- affiliate_balance_snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE affiliate_balance_snapshots (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    currency        text NOT NULL,
    pending_minor   bigint NOT NULL DEFAULT 0,
    held_minor      bigint NOT NULL DEFAULT 0,
    payable_minor   bigint NOT NULL DEFAULT 0,
    paid_minor      bigint NOT NULL DEFAULT 0,
    snapshot_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX affiliate_balance_snapshots_affiliate_idx ON affiliate_balance_snapshots (affiliate_id, snapshot_at DESC);

-- -----------------------------------------------------------------------------
-- affiliate_payout_methods
-- -----------------------------------------------------------------------------
CREATE TABLE affiliate_payout_methods (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    provider        text NOT NULL,
    provider_token  text NOT NULL,
    display_summary jsonb,
    status          text NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now(),
    disabled_at     timestamptz,
    CONSTRAINT affiliate_payout_methods_status_check CHECK (status IN ('active', 'disabled', 'invalid'))
);

CREATE INDEX affiliate_payout_methods_affiliate_idx ON affiliate_payout_methods (affiliate_id) WHERE status = 'active';

-- -----------------------------------------------------------------------------
-- affiliate_payout_requests
-- -----------------------------------------------------------------------------
CREATE TABLE affiliate_payout_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    method_id       uuid NOT NULL REFERENCES affiliate_payout_methods(id) ON DELETE RESTRICT,
    amount_minor    bigint NOT NULL,
    currency        text NOT NULL,
    status          text NOT NULL DEFAULT 'requested',
    reservation_ref uuid,
    provider_reference text,
    failure_reason  text,
    requested_at    timestamptz NOT NULL DEFAULT now(),
    approved_at     timestamptz,
    processing_at   timestamptz,
    completed_at    timestamptz,
    CONSTRAINT affiliate_payout_requests_status_check CHECK (status IN (
        'requested', 'validating', 'pending_review', 'approved', 'processing',
        'paid', 'failed', 'rejected', 'canceled', 'returned', 'reconciliation_required'
    ))
);

CREATE INDEX affiliate_payout_requests_affiliate_idx ON affiliate_payout_requests (affiliate_id, requested_at DESC);

-- -----------------------------------------------------------------------------
-- affiliate_payout_events
-- -----------------------------------------------------------------------------
CREATE TABLE affiliate_payout_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id       uuid NOT NULL REFERENCES affiliate_payout_requests(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- affiliate_payout_provider_transactions
-- -----------------------------------------------------------------------------
CREATE TABLE affiliate_payout_provider_transactions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id       uuid NOT NULL REFERENCES affiliate_payout_requests(id) ON DELETE CASCADE,
    provider        text NOT NULL,
    provider_tx_id  text,
    status          text NOT NULL,
    raw_response    jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- affiliate_payout_approvals
-- -----------------------------------------------------------------------------
CREATE TABLE affiliate_payout_approvals (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id       uuid NOT NULL REFERENCES affiliate_payout_requests(id) ON DELETE CASCADE,
    decision        text NOT NULL,
    decided_by      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason          text,
    decided_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT affiliate_payout_approvals_decision_check CHECK (decision IN ('approved', 'rejected'))
);

-- -----------------------------------------------------------------------------
-- affiliate_payment_adjustments
-- -----------------------------------------------------------------------------
CREATE TABLE affiliate_payment_adjustments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    accrual_id      uuid REFERENCES commission_accruals(id) ON DELETE SET NULL,
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    amount_minor    bigint NOT NULL,
    currency        text NOT NULL,
    reason          text NOT NULL,
    source_type     text,
    source_id       uuid,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- affiliate_fraud_cases
-- -----------------------------------------------------------------------------
CREATE TABLE affiliate_fraud_cases (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    state           text NOT NULL DEFAULT 'detected',
    severity        text NOT NULL,
    evidence        jsonb,
    opened_at       timestamptz NOT NULL DEFAULT now(),
    closed_at       timestamptz,
    CONSTRAINT affiliate_fraud_cases_state_check CHECK (state IN (
        'detected', 'under_review', 'additional_information_required',
        'cleared', 'confirmed_abuse', 'restricted', 'appealed', 'closed'
    )),
    CONSTRAINT affiliate_fraud_cases_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX affiliate_fraud_cases_affiliate_idx ON affiliate_fraud_cases (affiliate_id, opened_at DESC);

-- -----------------------------------------------------------------------------
-- referral_wallet
-- -----------------------------------------------------------------------------
CREATE TABLE referral_wallet (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    currency        text NOT NULL,
    available_minor bigint NOT NULL DEFAULT 0,
    pending_minor   bigint NOT NULL DEFAULT 0,
    held_minor      bigint NOT NULL DEFAULT 0,
    paid_minor      bigint NOT NULL DEFAULT 0,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (affiliate_id, currency)
);

-- -----------------------------------------------------------------------------
-- referral_monthly_settlements
-- -----------------------------------------------------------------------------
CREATE TABLE referral_monthly_settlements (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id    uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    period_start    timestamptz NOT NULL,
    period_end      timestamptz NOT NULL,
    gross_minor     bigint NOT NULL DEFAULT 0,
    deductions_minor bigint NOT NULL DEFAULT 0,
    net_minor       bigint NOT NULL DEFAULT 0,
    currency        text NOT NULL,
    status          text NOT NULL DEFAULT 'pending',
    frozen_at       timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (affiliate_id, period_start, period_end),
    CONSTRAINT referral_monthly_settlements_status_check CHECK (status IN ('pending', 'frozen', 'paid'))
);

-- -----------------------------------------------------------------------------
-- referral_audit_events
-- -----------------------------------------------------------------------------
CREATE TABLE referral_audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    affiliate_id    uuid REFERENCES affiliates(id) ON DELETE SET NULL,
    action          text NOT NULL,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    before          jsonb,
    after           jsonb,
    outcome         text NOT NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);