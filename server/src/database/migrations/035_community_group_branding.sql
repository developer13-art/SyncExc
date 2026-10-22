ALTER TABLE community_groups
    ADD COLUMN avatar_url text,
    ADD COLUMN cover_image_url text,
    ADD COLUMN topics text[] NOT NULL DEFAULT '{}';
