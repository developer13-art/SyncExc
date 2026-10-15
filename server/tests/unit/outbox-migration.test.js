import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrationUrl = new URL(
  '../../src/database/migrations/022_outbox_publishing_status.sql',
  import.meta.url
);

describe('outbox publishing status migration', () => {
  it('allows the publisher status without removing existing statuses', async () => {
    const migration = await readFile(migrationUrl, 'utf8');

    assert.match(migration, /DROP CONSTRAINT IF EXISTS outbox_events_status_check/i);
    assert.match(migration, /'pending'/);
    assert.match(migration, /'publishing'/);
    assert.match(migration, /'published'/);
    assert.match(migration, /'failed'/);
    assert.match(migration, /'dead_lettered'/);
  });
});
