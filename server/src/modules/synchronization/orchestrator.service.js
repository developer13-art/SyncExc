/**
 * SyncExc Server — Synchronization orchestrator
 *
 * Receives source events, resolves the affected group, computes destinations,
 * and hands each destination off to the dispatcher.
 */

import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { SYNC_STATUS } from '@syncexc/shared';
import { fnv1aHash } from '@syncexc/shared';

export function createOrchestrator({ db, queries, dispatcher, events, logger }) {
  /**
   * Ingest a source event from the exchange stream.
   */
  async function ingestSourceEvent(event) {
    const {
      sourceConnectionId,
      sourceAccountId,
      exchangeEventId,
      eventType,
      instrument,
      payload,
      occurredAt,
    } = event;

    // Find all groups whose source connection matches
    const { rows: groups } = await db.query(
      `
      SELECT * FROM sync_groups
      WHERE source_connection_id = $1
        AND source_account_id = $2
        AND status = 'active'
      `,
      [sourceConnectionId, sourceAccountId]
    );

    if (groups.length === 0) {
      logger.trace({ sourceConnectionId }, 'No active groups for source event');
      return { processed: 0 };
    }

    const results = [];

    for (const group of groups) {
      // Check if the event type is enabled for this group
      if (!group.enabled_event_types.includes(eventType)) continue;

      const result = await processGroupEvent({ group, event, occurredAt });
      results.push(result);
    }

    return { processed: results.length, results };
  }

  async function processGroupEvent({ group, event, occurredAt }) {
    // 1. Persist the source event (idempotent on exchange_event_id)
    const sourceEvent = await db.tx(async (tx) => {
      return queries.insertSourceEvent(tx, {
        groupId: group.id,
        sourceConnectionId: event.sourceConnectionId,
        sourceAccountId: event.sourceAccountId,
        exchangeEventId: event.exchangeEventId,
        eventType: event.eventType,
        instrument: event.instrument,
        payload: event.payload,
        occurredAt: occurredAt || new Date(),
      });
    });

    if (!sourceEvent) {
      // Duplicate — return early
      logger.debug(
        { exchangeEventId: event.exchangeEventId, groupId: group.id },
        'Duplicate source event ignored'
      );
      return { groupId: group.id, duplicate: true };
    }

    // 2. Create an operation
    const operation = await db.tx(async (tx) => {
      return queries.insertOperation(tx, {
        groupId: group.id,
        groupVersion: group.current_version,
        sourceEventId: sourceEvent.id,
        sourceEventType: event.eventType,
        sourceInstrument: event.instrument,
        requestedQuantity: event.payload?.quantity,
        requestedNotional: event.payload?.notional,
      });
    });

    // 3. Load destinations and dispatch
    const destinations = await queries.listActiveDestinationsForGroup(group.id);

    if (destinations.length === 0) {
      await queries.updateOperation(operation.id, { status: 'completed_with_exceptions', completedAt: new Date() });
      await queries.updateSourceEventStatus(sourceEvent.id, 'processed');
      return { groupId: group.id, operationId: operation.id, destinations: 0 };
    }

    await queries.updateOperation(operation.id, { status: 'processing' });

    // 4. For each destination, create a destination operation
    const destinationResults = [];
    for (const destination of destinations) {
      const destinationOp = await createDestinationOperation({
        operation,
        group,
        destination,
        event,
      });
      destinationResults.push(destinationOp);
    }

    // 5. Dispatch each destination operation asynchronously
    for (const destOp of destinationResults) {
      dispatcher.enqueueDispatch(destOp.id).catch((err) => {
        logger.error({ err, destOpId: destOp.id }, 'Dispatch enqueue failed');
      });
    }

    await queries.updateSourceEventStatus(sourceEvent.id, 'processing');

    return {
      groupId: group.id,
      operationId: operation.id,
      destinations: destinationResults.length,
    };
  }

  async function createDestinationOperation({ operation, group, destination, event }) {
    // Compute idempotency key from source event + destination
    const idempotencyKey = fnv1aHash(
      `sync:${event.exchangeEventId || event.correlationId}:${destination.id}:${event.eventType}`
    );

    return db.tx(async (tx) => {
      const destOp = await queries.insertDestinationOperation(tx, {
        operationId: operation.id,
        destinationId: destination.id,
        accountId: destination.account_id,
        requestedQuantity: null, // computed by the dispatcher
        requestedNotional: null,
        idempotencyKey,
      });
      return destOp;
    });
  }

  return {
    ingestSourceEvent,
    processGroupEvent,
  };
}

export default createOrchestrator;