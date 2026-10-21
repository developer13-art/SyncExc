CREATE TABLE community_conversations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_low uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_high uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state           text NOT NULL DEFAULT 'pending',
    last_message_at timestamptz NOT NULL DEFAULT now(),
    participant_low_read_at timestamptz,
    participant_high_read_at timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT community_conversations_pair_check CHECK (participant_low < participant_high),
    CONSTRAINT community_conversations_creator_check CHECK (
        created_by = participant_low OR created_by = participant_high
    ),
    CONSTRAINT community_conversations_state_check CHECK (
        state IN ('pending', 'active', 'rejected', 'closed')
    ),
    UNIQUE (participant_low, participant_high)
);

CREATE INDEX community_conversations_low_idx
    ON community_conversations (participant_low, state, last_message_at DESC);
CREATE INDEX community_conversations_high_idx
    ON community_conversations (participant_high, state, last_message_at DESC);

CREATE TABLE community_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES community_conversations(id) ON DELETE CASCADE,
    sender_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    edited_at       timestamptz,
    deleted_at      timestamptz
);

CREATE INDEX community_messages_conversation_idx
    ON community_messages (conversation_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
