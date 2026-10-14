/**
 * SyncExc Server — Events subsystem
 *
 * The event layer is built on the transactional outbox pattern:
 *
 *   1. A domain service writes its state change and an outbox_events row
 *      inside the same transaction.
 *   2. A background worker reads pending outbox rows, publishes them to the
 *      in-process event bus, and delivers them to any registered
 *      subscribers (in-process + external transports).
 *   3. Subscribers handle events idempotently. Failures are retried and
 *      eventually dead-lettered.
 *
 * This guarantees that a state change and its event are either both
 * committed or neither is.
 *
 * Public surface:
 *   events.bus          — in-process event bus for immediate subscribers
 *   events.outbox       — transactional outbox writer
 *   events.publish()    — enqueue an event for async delivery (via outbox)
 *   events.emitNow()    — dispatch an event synchronously (rare; used for
 *                          non-transactional notifications)
 *   events.subscribe()  — register a handler for an event type
 *   events.shutdown()   — stop workers gracefully
 */

import { createLogger } from '../lib/logger.js';
import { createEventBus } from './bus.js';
import { createEnvelopeBuilder } from './envelope.js';
import { createOutbox } from './outbox.js';
import { createPublisher } from './publisher.js';
import { createSubscriberRegistry } from './subscriber.js';
import { createConsumerRunner } from './consumer.js';
import { registerDefaultListeners } from './listeners.js';

export async function initEvents({ db, redis, logger: injectedLogger }) {
  const logger = injectedLogger || createLogger({ component: 'events' });

  const bus = createEventBus({ logger });
  const subscribers = createSubscriberRegistry({ logger });
  const envelope = createEnvelopeBuilder();
  const outbox = createOutbox({ db, envelope, logger });

  const publisher = createPublisher({
    db,
    redis,
    bus,
    subscribers,
    envelope,
    logger,
  });

  const consumer = createConsumerRunner({
    db,
    publisher,
    logger,
  });

  // Register module-level default listeners (audit writer, metrics, etc.)
  await registerDefaultListeners({ subscribers, db, logger });

  // Start the outbox publisher worker
  await publisher.start();
  await consumer.start();

  logger.info('Events subsystem initialized');

  return {
    bus,
    outbox,
    subscribers,
    envelope,

    /**
     * Enqueue an event for transactional async delivery.
     * Call this inside a transaction along with your state change.
     */
    async publish(tx, eventType, payload, options = {}) {
      return outbox.enqueue(tx, eventType, payload, options);
    },

    /**
     * Emit an event to the in-process bus immediately, without going
     * through the outbox. Use for non-transactional events only.
     */
    emitNow(eventType, payload, options = {}) {
      const envelopeData = envelope.create(eventType, payload, options);
      bus.emit(envelopeData);
      return envelopeData;
    },

    /**
     * Register a handler for one or more event types.
     */
    subscribe(eventTypes, handler, options = {}) {
      return subscribers.register(eventTypes, handler, options);
    },

    /**
     * Gracefully stop publisher + consumer.
     */
    async shutdown() {
      logger.info('Shutting down events subsystem');
      await publisher.shutdown();
      await consumer.shutdown();
      bus.removeAllListeners();
    },
  };
}

export default initEvents;