CREATE TABLE IF NOT EXISTS telegram_auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  encrypted_state text NOT NULL,
  status text NOT NULL DEFAULT 'code_sent',
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_auth_sessions_status_check
    CHECK (status IN ('request_pending', 'request_failed', 'code_sent', 'password_required', 'verified'))
);

CREATE INDEX IF NOT EXISTS telegram_auth_sessions_user_created_idx
  ON telegram_auth_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS telegram_auth_sessions_expiry_idx
  ON telegram_auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS telegram_user_message_cursors (
  source_id uuid PRIMARY KEY REFERENCES signal_sources(id) ON DELETE CASCADE,
  last_message_id bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
