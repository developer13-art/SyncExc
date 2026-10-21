CREATE TABLE community_follow_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state           text NOT NULL DEFAULT 'pending',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    responded_at    timestamptz,
    CONSTRAINT community_follow_requests_no_self CHECK (follower_id <> followee_id),
    CONSTRAINT community_follow_requests_state_check CHECK (state IN ('pending', 'accepted', 'declined')),
    UNIQUE (follower_id, followee_id)
);

CREATE INDEX community_follow_requests_inbox_idx
    ON community_follow_requests (followee_id, created_at DESC)
    WHERE state = 'pending';

CREATE TRIGGER community_follow_requests_set_updated_at
    BEFORE UPDATE ON community_follow_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
