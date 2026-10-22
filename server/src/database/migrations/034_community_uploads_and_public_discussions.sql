ALTER TABLE community_channels
    ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Existing non-group channels become shared across all authenticated accounts.
UPDATE community_channels
SET is_public = true
WHERE group_id IS NULL;

ALTER TABLE community_channels
    DROP CONSTRAINT community_channels_owner_check;

ALTER TABLE community_channels
    ADD CONSTRAINT community_channels_owner_check
    CHECK (group_id IS NOT NULL OR workspace_id IS NOT NULL OR is_public);

CREATE TABLE community_attachments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_key     text NOT NULL UNIQUE,
    file_name       text NOT NULL,
    mime_type       text NOT NULL,
    size_bytes      bigint NOT NULL CHECK (size_bytes > 0),
    resource_type   text,
    resource_id     uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT community_attachments_resource_check
        CHECK (
            (resource_type IS NULL AND resource_id IS NULL)
            OR (
                resource_type IN ('post', 'comment', 'direct_message', 'discussion_message')
                AND resource_id IS NOT NULL
            )
        )
);

CREATE INDEX community_attachments_resource_idx
    ON community_attachments (resource_type, resource_id, created_at)
    WHERE resource_id IS NOT NULL;

CREATE INDEX community_attachments_pending_idx
    ON community_attachments (uploader_id, created_at)
    WHERE resource_id IS NULL;
