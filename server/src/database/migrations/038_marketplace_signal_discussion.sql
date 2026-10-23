CREATE TABLE marketplace_signal_comments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id       uuid NOT NULL REFERENCES marketplace_published_signals(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         text NOT NULL DEFAULT '',
    proof_data      bytea,
    proof_name      text,
    proof_mime_type text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT marketplace_signal_comments_content_check CHECK (
        length(content) <= 5000 AND (length(trim(content)) > 0 OR proof_data IS NOT NULL)
    ),
    CONSTRAINT marketplace_signal_comments_proof_check CHECK (
        (proof_data IS NULL AND proof_name IS NULL AND proof_mime_type IS NULL)
        OR (proof_data IS NOT NULL AND proof_name IS NOT NULL AND proof_mime_type IN ('image/jpeg', 'image/png', 'image/webp'))
    )
);

CREATE INDEX marketplace_signal_comments_signal_idx
    ON marketplace_signal_comments (signal_id, created_at ASC);

ALTER TABLE copy_configurations
    ADD COLUMN created_by uuid REFERENCES users(id) ON DELETE SET NULL;

UPDATE copy_configurations config
SET created_by = workspace.owner_id
FROM workspaces workspace
WHERE config.workspace_id = workspace.id;
