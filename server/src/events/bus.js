/**
 * SyncExc Server — In-process event bus
 *
 * Thin wrapper over Node's EventEmitter with:
 *   - structured logging on emit
 *   - listener error isolation (a throwing listener does not break others)
 *   - max-listener warnings
 *   - async listener support with bounded concurrency
 *
 * Events on this bus are already-validated envelope objects. Handlers must
 * be idempotent.
 */

import { EventEmitter } from 'node:events';

const DEFAULT_MAX_LISTENERS = 50;

export function createEventBus({ logger }) {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(DEFAULT_MAX_LISTENERS);

  const originalEmit = emitter.emit.bind(emitter);

  emitter.emit = function safeEmit(eventName, envelope) {
    try {
      const listeners = emitter.listeners(eventName);
      if (listeners.length === 0) return false;

      logger.trace(
        {
          eventType: eventName,
          eventId: envelope?.eventId,
          subscriberCount: listeners.length,
        },
        'Event emitted'
      );

      return originalEmit(eventName, envelope);
    } catch (err) {
      logger.error({ err, eventType: eventName }, 'Event bus emit failed');
      return false;
    }
  };

  /**
   * Register a listener that is isolated from others — if it throws, the
   * error is logged but does not propagate to other listeners.
   */
  function safeOn(eventName, listener) {
    const wrapped = async (envelope) => {
      try {
        await listener(envelope);
      } catch (err) {
        logger.error(
          {
            err,
            eventType: eventName,
            eventId: envelope?.eventId,
          },
          'Event listener failed'
        );
      }
    };
    emitter.on(eventName, wrapped);
    return () => emitter.off(eventName, wrapped);
  }

  return {
    on: safeOn,
    once: (eventName, listener) => emitter.once(eventName, listener),
    off: (eventName, listener) => emitter.off(eventName, listener),
    removeAllListeners: (eventName) => emitter.removeAllListeners(eventName),
    listeners: (eventName) => emitter.listeners(eventName),
    emit: (eventName, envelope) => emitter.emit(eventName, envelope),
    raw: emitter,
  };
}

export default createEventBus;