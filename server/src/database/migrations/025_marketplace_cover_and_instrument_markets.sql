ALTER TABLE marketplace_provider_profiles
    ADD COLUMN IF NOT EXISTS cover_image_url text;

ALTER TABLE exchange_instruments
    DROP CONSTRAINT IF EXISTS exchange_instruments_exchange_code_exchange_symbol_key;

CREATE UNIQUE INDEX IF NOT EXISTS exchange_instruments_market_symbol_unique
    ON exchange_instruments (exchange_code, exchange_symbol, market_type);
