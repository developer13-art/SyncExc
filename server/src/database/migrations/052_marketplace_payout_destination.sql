ALTER TABLE marketplace_trader_payout_requests
    ADD COLUMN payout_account_encrypted text,
    ADD COLUMN payout_account_name text,
    ADD COLUMN payout_bank_name text,
    ADD COLUMN payout_country_code char(2),
    ADD COLUMN payout_account_last4 char(4);
