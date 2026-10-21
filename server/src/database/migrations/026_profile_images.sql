CREATE TABLE IF NOT EXISTS profile_images (
    image_key   text PRIMARY KEY,
    content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    image_data  bytea NOT NULL CHECK (octet_length(image_data) <= 5242880),
    created_at  timestamptz NOT NULL DEFAULT now()
);
