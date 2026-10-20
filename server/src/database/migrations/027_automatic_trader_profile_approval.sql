-- New Trader profiles are approved automatically, and existing pending profiles
-- are transitioned so their owners can publish without a manual review queue.
ALTER TABLE marketplace_provider_profiles
    ALTER COLUMN moderation_state SET DEFAULT 'approved';

UPDATE marketplace_provider_profiles
SET moderation_state = 'approved',
    updated_at = now()
WHERE moderation_state = 'pending_review';
