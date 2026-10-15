/**
 * SyncExc Server — Alert event service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createAlertEventService({ db, queries, events, logger }) {
  async function createEvent({ ruleId, severity, message }) {
    const event = await db.tx(async (tx) => {
      return queries.insertAlertEvent(tx, {
        ruleId,
        severity,
        message,
      });
    });

    await events.publish(db, 'admin.alert_created', {
      alertId: event.id,
      severity,
      message,
    }, {
      resourceType: 'admin_alert_event',
      resourceId: event.id,
    });

    return event;
  }

  async function listEvents({ state, limit }) {
    return queries.listAlertEvents({ state, limit });
  }

  async function acknowledge({ eventId, userId }) {
    const result = await queries.acknowledgeAlertEvent(eventId, userId);
    if (!result) throw new NotFoundError('Alert');
    return result;
  }

  async function resolve({ eventId }) {
    const result = await queries.resolveAlertEvent(eventId);
    if (!result) throw new NotFoundError('Alert');
    return result;
  }

  return {
    createEvent,
    listEvents,
    acknowledge,
    resolve,
  };
}

export default createAlertEventService;