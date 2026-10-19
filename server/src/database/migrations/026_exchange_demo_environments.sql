ALTER TABLE exchange_connections
  DROP CONSTRAINT IF EXISTS exchange_connections_environment_check;

ALTER TABLE exchange_connections
  ADD CONSTRAINT exchange_connections_environment_check
  CHECK (environment IN ('live', 'testnet', 'demo'));
