-- Personal preferences are separate from workspace permissions and risk policy.
CREATE TABLE user_preferences (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    general_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
    trading_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_preferences_general_object CHECK (jsonb_typeof(general_preferences) = 'object'),
    CONSTRAINT user_preferences_trading_object CHECK (jsonb_typeof(trading_preferences) = 'object')
);
