-- =============================================================================
-- 015_community.sql
-- Module 15 — Community and Collaboration
-- =============================================================================

CREATE TABLE community_profiles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    handle          text NOT NULL UNIQUE,
    display_name    text NOT NULL,
    biography       text,
    long_introduction text,
    avatar_url      text,
    interests       text[] NOT NULL DEFAULT '{}',
    skills          text[] NOT NULL DEFAULT '{}',
    website         text,
    visibility      text NOT NULL DEFAULT 'public',
    current_version integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT community_profiles_visibility_check CHECK (visibility IN (
        'public', 'followers', 'group_members', 'workspace_members', 'private'
    ))
);

CREATE TRIGGER community_profiles_set_updated_at BEFORE UPDATE ON community_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE community_profile_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      uuid NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    snapshot        jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (profile_id, version)
);

CREATE TABLE community_profile_privacy (
    profile_id            uuid PRIMARY KEY REFERENCES community_profiles(id) ON DELETE CASCADE,
    allow_follows         boolean NOT NULL DEFAULT true,
    allow_mentions        boolean NOT NULL DEFAULT true,
    allow_direct_messages boolean NOT NULL DEFAULT false,
    allow_recommendations boolean NOT NULL DEFAULT true,
    updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_profile_links (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      uuid NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
    label           text NOT NULL,
    url             text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_topics (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            text NOT NULL UNIQUE,
    name            text NOT NULL,
    description     text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_user_interests (
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id        uuid NOT NULL REFERENCES community_topics(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE community_topic_follows (
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id        uuid NOT NULL REFERENCES community_topics(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE community_follows (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (follower_id, followee_id),
    CONSTRAINT community_follows_no_self CHECK (follower_id <> followee_id)
);

CREATE TABLE community_blocks (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (blocker_id, blocked_id),
    CONSTRAINT community_blocks_no_self CHECK (blocker_id <> blocked_id)
);

CREATE TABLE community_posts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    destination_type text NOT NULL,
    destination_ref_id uuid,
    content         text NOT NULL,
    topics          text[] NOT NULL DEFAULT '{}',
    visibility      text NOT NULL DEFAULT 'public',
    allow_comments  boolean NOT NULL DEFAULT true,
    engagement      jsonb NOT NULL DEFAULT '{"reactions":0,"comments":0,"shares":0}'::jsonb,
    current_version integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    CONSTRAINT community_posts_destination_check CHECK (destination_type IN (
        'public_feed', 'group', 'workspace_discussion'
    ))
);

CREATE INDEX community_posts_author_idx ON community_posts (author_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX community_posts_destination_idx ON community_posts (destination_type, destination_ref_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TRIGGER community_posts_set_updated_at BEFORE UPDATE ON community_posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE community_post_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    content         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (post_id, version)
);

CREATE TABLE community_post_attachments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    type            text NOT NULL,
    storage_key     text NOT NULL,
    mime_type       text,
    size_bytes      bigint,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_post_topics (
    post_id         uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    topic_id        uuid NOT NULL REFERENCES community_topics(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, topic_id)
);

CREATE TABLE community_comments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    parent_id       uuid REFERENCES community_comments(id) ON DELETE CASCADE,
    author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         text NOT NULL,
    current_version integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE INDEX community_comments_post_idx ON community_comments (post_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER community_comments_set_updated_at BEFORE UPDATE ON community_comments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE community_comment_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id      uuid NOT NULL REFERENCES community_comments(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    content         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (comment_id, version)
);

CREATE TABLE community_reactions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type     text NOT NULL,
    target_id       uuid NOT NULL,
    reaction_type   text NOT NULL DEFAULT 'like',
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT community_reactions_target_check CHECK (target_type IN ('post', 'comment'))
);

CREATE UNIQUE INDEX community_reactions_unique ON community_reactions (user_id, target_type, target_id);

CREATE TABLE community_groups (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
    name            text NOT NULL,
    slug            text NOT NULL UNIQUE,
    description     text,
    type            text NOT NULL,
    visibility      text NOT NULL,
    member_count    integer NOT NULL DEFAULT 0,
    current_version integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT community_groups_type_check CHECK (type IN ('public', 'private', 'approval_based', 'organization')),
    CONSTRAINT community_groups_visibility_check CHECK (visibility IN (
        'public', 'followers', 'group_members', 'workspace_members', 'private'
    ))
);

CREATE TRIGGER community_groups_set_updated_at BEFORE UPDATE ON community_groups
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE community_group_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    snapshot        jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_id, version)
);

CREATE TABLE community_group_memberships (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state           text NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_id, user_id),
    CONSTRAINT community_group_memberships_state_check CHECK (state IN (
        'invited', 'requested', 'active', 'muted', 'restricted', 'left', 'removed', 'banned'
    ))
);

CREATE INDEX community_group_memberships_user_idx ON community_group_memberships (user_id) WHERE state = 'active';

CREATE TRIGGER community_group_memberships_set_updated_at
    BEFORE UPDATE ON community_group_memberships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE community_group_invitations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
    invited_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    state           text NOT NULL DEFAULT 'pending',
    created_at      timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz,
    CONSTRAINT community_group_invitations_state_check CHECK (state IN ('pending', 'accepted', 'declined', 'expired'))
);

CREATE TABLE community_group_roles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_id, user_id),
    CONSTRAINT community_group_roles_role_check CHECK (role IN ('owner', 'administrator', 'moderator', 'member', 'read_only'))
);

CREATE TABLE community_group_permissions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
    permission_key  text NOT NULL,
    scope           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_id, permission_key, scope)
);

CREATE TABLE community_channels (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        uuid REFERENCES community_groups(id) ON DELETE CASCADE,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    name            text NOT NULL,
    kind            text NOT NULL DEFAULT 'general',
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT community_channels_owner_check CHECK (group_id IS NOT NULL OR workspace_id IS NOT NULL)
);

CREATE TABLE community_discussion_threads (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      uuid NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
    title           text NOT NULL,
    created_by      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER community_discussion_threads_set_updated_at
    BEFORE UPDATE ON community_discussion_threads
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE community_discussion_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       uuid NOT NULL REFERENCES community_discussion_threads(id) ON DELETE CASCADE,
    author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE INDEX community_discussion_messages_thread_idx
    ON community_discussion_messages (thread_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE community_analysis_documents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    title           text NOT NULL,
    summary         text,
    tags            text[] NOT NULL DEFAULT '{}',
    visibility      text NOT NULL DEFAULT 'private',
    current_version integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT community_analysis_documents_visibility_check CHECK (visibility IN (
        'public', 'followers', 'group_members', 'workspace_members', 'private'
    ))
);

CREATE TRIGGER community_analysis_documents_set_updated_at
    BEFORE UPDATE ON community_analysis_documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE community_analysis_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     uuid NOT NULL REFERENCES community_analysis_documents(id) ON DELETE CASCADE,
    version         integer NOT NULL,
    content         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (document_id, version)
);

CREATE TABLE community_analysis_permissions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     uuid NOT NULL REFERENCES community_analysis_documents(id) ON DELETE CASCADE,
    grantee_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    grantee_workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    permission      text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT community_analysis_permissions_check CHECK (
        grantee_user_id IS NOT NULL OR grantee_workspace_id IS NOT NULL
    )
);

CREATE TABLE community_analysis_comments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     uuid NOT NULL REFERENCES community_analysis_documents(id) ON DELETE CASCADE,
    author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_analysis_sources (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     uuid NOT NULL REFERENCES community_analysis_documents(id) ON DELETE CASCADE,
    source_type     text NOT NULL,
    source_ref      text,
    provenance      text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_saved_items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    collection      text,
    note            text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, resource_type, resource_id)
);

CREATE TABLE community_mentions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mentioned_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    resolved_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_ai_recommendations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommendation_type text NOT NULL,
    target_ref      jsonb NOT NULL,
    explanation     text NOT NULL,
    score           numeric(5, 2),
    expires_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT community_ai_recommendations_type_check CHECK (recommendation_type IN (
        'people', 'groups', 'discussions', 'communities'
    ))
);

CREATE TABLE community_recommendation_feedback (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id uuid NOT NULL REFERENCES community_ai_recommendations(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feedback        text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT community_recommendation_feedback_check CHECK (feedback IN ('dismissed', 'helpful', 'not_helpful', 'reported'))
);

CREATE TABLE community_search_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    query_text      text NOT NULL,
    result_count    integer NOT NULL DEFAULT 0,
    filters         jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_moderation_cases (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     uuid REFERENCES users(id) ON DELETE SET NULL,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    reason          text NOT NULL,
    details         text,
    state           text NOT NULL DEFAULT 'pending',
    assigned_to     uuid REFERENCES users(id) ON DELETE SET NULL,
    opened_at       timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz,
    CONSTRAINT community_moderation_cases_state_check CHECK (state IN (
        'pending', 'under_review', 'resolved', 'dismissed', 'escalated'
    ))
);

CREATE TABLE community_moderation_actions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         uuid NOT NULL REFERENCES community_moderation_cases(id) ON DELETE CASCADE,
    actor_id        uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action          text NOT NULL,
    reason          text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_moderation_appeals (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         uuid NOT NULL REFERENCES community_moderation_cases(id) ON DELETE CASCADE,
    appellant_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason          text NOT NULL,
    status          text NOT NULL DEFAULT 'pending',
    resolved_at     timestamptz,
    resolution      text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT community_moderation_appeals_status_check CHECK (status IN ('pending', 'upheld', 'overturned', 'dismissed'))
);

CREATE TABLE community_abuse_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    event_type      text NOT NULL,
    metadata        jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    action          text NOT NULL,
    resource_type   text NOT NULL,
    resource_id     uuid NOT NULL,
    before          jsonb,
    after           jsonb,
    outcome         text NOT NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_usage_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
    metric          text NOT NULL,
    amount          bigint NOT NULL DEFAULT 1,
    recorded_at     timestamptz NOT NULL DEFAULT now()
);