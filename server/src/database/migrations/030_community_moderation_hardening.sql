CREATE UNIQUE INDEX community_moderation_pending_appeal_unique_idx
    ON community_moderation_appeals (case_id, appellant_id)
    WHERE status = 'pending';

CREATE INDEX community_moderation_cases_state_cursor_idx
    ON community_moderation_cases (state, opened_at DESC);

CREATE INDEX community_audit_events_cursor_idx
    ON community_audit_events (occurred_at DESC);

CREATE INDEX community_audit_events_resource_idx
    ON community_audit_events (resource_type, resource_id, occurred_at DESC);
