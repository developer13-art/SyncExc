ALTER TABLE marketplace_provider_profiles
    ADD COLUMN stripe_connect_account_id text UNIQUE,
    ADD COLUMN stripe_country char(2),
    ADD COLUMN stripe_details_submitted boolean NOT NULL DEFAULT false,
    ADD COLUMN stripe_transfers_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN stripe_payouts_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE marketplace_subscriptions
    ADD COLUMN stripe_checkout_session_id text UNIQUE,
    ADD COLUMN stripe_checkout_url text,
    ADD COLUMN stripe_customer_id text,
    ADD COLUMN stripe_subscription_id text UNIQUE,
    ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX marketplace_subscriptions_pending_unique
    ON marketplace_subscriptions (provider_id, subscriber_user_id)
    WHERE status = 'subscription_pending';

CREATE TABLE marketplace_stripe_webhook_events (
    event_id text PRIMARY KEY,
    event_type text NOT NULL,
    processed_at timestamptz NOT NULL DEFAULT now()
);
