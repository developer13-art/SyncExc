CREATE TABLE marketplace_trader_payout_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    requested_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency char(3) NOT NULL,
    amount_minor bigint NOT NULL CHECK (amount_minor > 0),
    status text NOT NULL DEFAULT 'pending',
    payout_reference text,
    note text,
    reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT marketplace_trader_payout_requests_status_check
        CHECK (status IN ('pending', 'paid', 'rejected'))
);

CREATE UNIQUE INDEX marketplace_trader_payout_requests_pending_unique
    ON marketplace_trader_payout_requests (provider_id, currency)
    WHERE status = 'pending';

ALTER TABLE marketplace_trader_earnings
    ADD COLUMN payout_request_id uuid
        REFERENCES marketplace_trader_payout_requests(id) ON DELETE SET NULL;

CREATE INDEX marketplace_trader_earnings_payout_request_idx
    ON marketplace_trader_earnings (payout_request_id)
    WHERE payout_request_id IS NOT NULL;
