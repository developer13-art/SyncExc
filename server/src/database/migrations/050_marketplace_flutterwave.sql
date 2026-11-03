ALTER TABLE marketplace_provider_plans
    ADD COLUMN flutterwave_payment_plan_id text;

ALTER TABLE marketplace_subscriptions
    ADD COLUMN billing_provider text,
    ADD COLUMN flutterwave_checkout_reference text UNIQUE,
    ADD COLUMN flutterwave_checkout_url text,
    ADD COLUMN flutterwave_payment_plan_id text,
    ADD COLUMN flutterwave_customer_id text,
    ADD COLUMN flutterwave_subscription_id text;

CREATE INDEX marketplace_subscriptions_flutterwave_lookup_idx
    ON marketplace_subscriptions (flutterwave_payment_plan_id, flutterwave_customer_id);

CREATE TABLE marketplace_flutterwave_checkout_references (
    reference text PRIMARY KEY,
    subscription_id uuid NOT NULL REFERENCES marketplace_subscriptions(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE marketplace_flutterwave_webhook_events (
    event_id text PRIMARY KEY,
    event_type text NOT NULL,
    processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE marketplace_trader_earnings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    subscription_id uuid NOT NULL REFERENCES marketplace_subscriptions(id) ON DELETE CASCADE,
    provider_payment_reference text NOT NULL UNIQUE,
    gross_amount_minor bigint NOT NULL CHECK (gross_amount_minor > 0),
    platform_fee_minor bigint NOT NULL CHECK (platform_fee_minor >= 0),
    trader_net_amount_minor bigint NOT NULL CHECK (trader_net_amount_minor >= 0),
    currency char(3) NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    payout_reference text,
    payout_note text,
    paid_by uuid REFERENCES users(id) ON DELETE SET NULL,
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT marketplace_trader_earnings_status_check
        CHECK (status IN ('pending', 'paid', 'reversed'))
);

CREATE INDEX marketplace_trader_earnings_provider_status_idx
    ON marketplace_trader_earnings (provider_id, status, created_at DESC);

INSERT INTO admin_permission_definitions (permission_key, category, description)
VALUES
    ('admin.marketplace.earnings.view', 'billing', 'View Trader marketplace earnings'),
    ('admin.marketplace.earnings.manage', 'billing', 'Record manual Trader marketplace payouts')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM admin_role_definitions role
JOIN admin_permission_definitions permission
  ON permission.permission_key = 'admin.marketplace.earnings.view'
WHERE role.name IN ('billing_administrator', 'financial_approver')
ON CONFLICT DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM admin_role_definitions role
JOIN admin_permission_definitions permission
  ON permission.permission_key = 'admin.marketplace.earnings.manage'
WHERE role.name = 'financial_approver'
ON CONFLICT DO NOTHING;
