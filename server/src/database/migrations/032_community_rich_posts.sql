CREATE TABLE community_post_polls (
    post_id         uuid PRIMARY KEY REFERENCES community_posts(id) ON DELETE CASCADE,
    question        text NOT NULL,
    allow_multiple  boolean NOT NULL DEFAULT false,
    closes_at       timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_poll_options (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_post_id    uuid NOT NULL REFERENCES community_post_polls(post_id) ON DELETE CASCADE,
    position        integer NOT NULL,
    label           text NOT NULL,
    UNIQUE (poll_post_id, id),
    UNIQUE (poll_post_id, position)
);

CREATE TABLE community_poll_votes (
    poll_post_id    uuid NOT NULL,
    option_id       uuid NOT NULL,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (poll_post_id, option_id, user_id),
    FOREIGN KEY (poll_post_id, option_id)
      REFERENCES community_poll_options (poll_post_id, id) ON DELETE CASCADE
);

CREATE INDEX community_poll_votes_option_idx
    ON community_poll_votes (poll_post_id, option_id);

CREATE TABLE community_post_events (
    post_id         uuid PRIMARY KEY REFERENCES community_posts(id) ON DELETE CASCADE,
    starts_at       timestamptz NOT NULL,
    ends_at         timestamptz,
    timezone        text NOT NULL DEFAULT 'UTC',
    location        text,
    capacity        integer,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT community_post_events_capacity_check CHECK (capacity IS NULL OR capacity > 0),
    CONSTRAINT community_post_events_time_check CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE community_event_rsvps (
    post_id         uuid NOT NULL REFERENCES community_post_events(post_id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          text NOT NULL,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id),
    CONSTRAINT community_event_rsvps_status_check
      CHECK (status IN ('going', 'interested', 'declined'))
);

CREATE INDEX community_event_rsvps_status_idx
    ON community_event_rsvps (post_id, status);

CREATE TABLE community_market_ideas (
    post_id         uuid PRIMARY KEY REFERENCES community_posts(id) ON DELETE CASCADE,
    instrument      text NOT NULL,
    market_type     text NOT NULL DEFAULT 'spot',
    direction       text NOT NULL,
    timeframe       text NOT NULL,
    thesis          text NOT NULL,
    entry_price     numeric(36, 18),
    stop_loss       numeric(36, 18),
    take_profit     numeric(36, 18),
    invalidation    text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT community_market_ideas_direction_check
      CHECK (direction IN ('long', 'short', 'neutral')),
    CONSTRAINT community_market_ideas_market_check
      CHECK (market_type IN ('spot', 'futures', 'options', 'forex', 'equities', 'other')),
    CONSTRAINT community_market_ideas_prices_check CHECK (
      (entry_price IS NULL OR entry_price > 0)
      AND (stop_loss IS NULL OR stop_loss > 0)
      AND (take_profit IS NULL OR take_profit > 0)
    )
);
