-- Allow the outbox publisher to mark events while they are being processed.
ALTER TABLE outbox_events
  DROP CONSTRAINT IF EXISTS outbox_events_status_check;

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_status_check
  CHECK (status IN ('pending', 'publishing', 'published', 'failed', 'dead_lettered'));
