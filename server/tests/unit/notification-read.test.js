import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { serializeNotification } from '../../src/lib/serializers.js';
import { createNotificationQueries } from '../../src/modules/notifications/notifications.queries.js';

describe('notification read state', () => {
  it('serializes read state and message fields for the client', () => {
    const notification = serializeNotification({
      id: 'notification-1',
      user_id: 'user-1',
      event_type: 'example.event',
      category: 'activity',
      priority: 'normal',
      title: 'Update',
      message: 'An update is available',
      action: { url: '/app/activity' },
      status: 'read',
      created_at: new Date('2026-01-01T00:00:00Z'),
      read_at: new Date('2026-01-01T00:01:00Z'),
    });

    assert.equal(notification.read, true);
    assert.equal(notification.body, 'An update is available');
    assert.equal(notification.severity, 'normal');
    assert.equal(notification.actionUrl, '/app/activity');
  });

  it('allows marking an already-read notification read again for its owner', async () => {
    let sql;
    let values;
    const notification = { id: 'notification-1', read_at: new Date() };
    const queries = createNotificationQueries({
      db: {
        async query(query, parameters) {
          sql = query;
          values = parameters;
          return { rows: [notification] };
        },
      },
    });

    const result = await queries.markRead('notification-1', 'user-1');

    assert.match(sql, /COALESCE\(read_at, now\(\)\)/);
    assert.match(sql, /id = \$1 AND user_id = \$2 AND archived_at IS NULL/);
    assert.deepEqual(values, ['notification-1', 'user-1']);
    assert.equal(result, notification);
  });

  it('filters notification pages and returns the matching total', async () => {
    const calls = [];
    const queries = createNotificationQueries({
      db: {
        async query(sql, parameters) {
          calls.push({ sql, parameters });
          if (calls.length === 1) return { rows: [{ total: 1 }] };
          return {
            rows: [{ id: 'notification-1', created_at: new Date('2026-01-01T00:00:00Z') }],
          };
        },
      },
    });

    const result = await queries.listNotificationsForUser('user-1', {
      category: 'billing',
      readOnly: true,
      q: 'invoice',
      limit: 25,
      offset: 25,
    });

    assert.equal(result.total, 1);
    assert.equal(result.rows.length, 1);
    assert.match(calls[0].sql, /read_at IS NOT NULL/);
    assert.match(calls[0].sql, /title ILIKE/);
    assert.match(calls[1].sql, /LIMIT \$4 OFFSET \$5/);
    assert.deepEqual(calls[1].parameters, ['user-1', 'billing', '%invoice%', 26, 25]);
  });
});
