/**
 * SyncExc Server — Subscriber registry
 *
 * Modules register handlers for events they care about. The publisher
 * dispatches to all matching handlers.
 *
 * Handlers are called with the full envelope. They must be idempotent — the
 * same event may be delivered more than once on retry.
 *
 * Registration is index-based for O(1) lookup on dispatch.
 */

import { createLogger } from '../lib/logger.js';

export function createSubscriberRegistry({ logger: injectedLogger }) {
  const logger = injectedLogger || createLogger({ component: 'events:subscribers' });

  /** eventType → array of handlers */
  const handlers = new Map();

  /** handler id → cleanup */
  const registrations = new Map();

  let nextId = 1;

  function normalizeEventTypes(eventTypes) {
    if (Array.isArray(eventTypes)) return eventTypes;
    if (typeof eventTypes === 'string') return [eventTypes];
    if (eventTypes === '*') return ['*'];
    throw new Error('eventTypes must be a string, array of strings, or "*"');
  }

  return {
    /**
     * Register a handler for one or more event types.
     *
     * @param {string|string[]} eventTypes
     * @param {(envelope: object) => Promise<void>} handler
     * @param {object} [options]
     * @param {string} [options.name]    Friendly handler name for logs
     * @returns {() => void}             Unregister function
     */
    register(eventTypes, handler, options = {}) {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }

      const types = normalizeEventTypes(eventTypes);
      const id = nextId++;
      const name = options.name || `handler#${id}`;

      for (const type of types) {
        if (!handlers.has(type)) handlers.set(type, []);
        handlers.get(type).push({ id, name, handler });
      }

      logger.debug({ id, name, eventTypes: types }, 'Subscriber registered');

      const unregister = () => {
        for (const type of types) {
          const list = handlers.get(type);
          if (!list) continue;
          const filtered = list.filter((entry) => entry.id !== id);
          if (filtered.length === 0) handlers.delete(type);
          else handlers.set(type, filtered);
        }
        registrations.delete(id);
        logger.debug({ id, name }, 'Subscriber unregistered');
      };

      registrations.set(id, unregister);
      return unregister;
    },

    /**
     * Get all handlers registered for an event type.
     * Includes wildcard handlers registered with '*'.
     */
    getHandlers(eventType) {
      const specific = handlers.get(eventType) || [];
      const wildcard = handlers.get('*') || [];
      return [...specific, ...wildcard].map((entry) => entry.handler);
    },

    /**
     * List all registrations (for diagnostics).
     */
    list() {
      const out = [];
      for (const [eventType, list] of handlers.entries()) {
        for (const entry of list) {
          out.push({ eventType, id: entry.id, name: entry.name });
        }
      }
      return out;
    },

    /**
     * Count of handlers for an event type.
     */
    count(eventType) {
      return this.getHandlers(eventType).length;
    },

    /**
     * Clear all registrations.
     */
    clear() {
      handlers.clear();
      registrations.clear();
    },
  };
}

export default createSubscriberRegistry;