/**
 * SyncExc Server — Event envelope
 *
 * Every event that flows through the system uses a single envelope shape.
 * The envelope is created by this module and validated on ingestion.
 *
 * Envelope fields:
 *   eventId          uuid
 *   eventType        string (dotted, e.g. "user.registered")
 *   schemaVersion    string (e.g. "v1")
 *   occurredAt       ISO timestamp
 *   ingestedAt       ISO timestamp
 *   correlationId    uuid — ties this event to the request/job that caused it
 *   actorId          uuid|null
 *   workspaceId      uuid|null
 *   resourceType     string
 *   resourceId       string
 *   payload          object
 *   idempotencyKey   string|null
 *   sourceModule     string
 */

import { randomUUID } from 'node:crypto';
import { EventEnvelopeSchema } from '@syncexc/shared';

const DEFAULT_SCHEMA_VERSION = 'v1';

/**
 * Map event type prefix → source module. Keeps event provenance explicit.
 */
const SOURCE_MODULE_BY_PREFIX = {
  user: 'identity',
  workspace: 'workspaces',
  billing: 'billing',
  payment: 'billing',
  subscription: 'billing',
  refund: 'billing',
  connection: 'connections',
  credential: 'connections',
  execution: 'terminal',
  order: 'terminal',
  position: 'terminal',
  sync: 'synchronization',
  risk: 'risk',
  incident: 'risk',
  source: 'sources',
  signal: 'signals',
  marketplace: 'marketplace',
  provider: 'marketplace',
  copy: 'marketplace',
  automation: 'automation',
  workflow: 'automation',
  simulation: 'simulation',
  referral: 'referral',
  commission: 'referral',
  payout: 'referral',
  developer: 'developer',
  application: 'developer',
  webhook: 'developer',
  community: 'community',
  post: 'community',
  group: 'community',
  moderation: 'community',
  notification: 'notifications',
  support: 'support',
  ticket: 'support',
  admin: 'admin',
  feature: 'admin',
  platform: 'incidents',
};

function deriveSourceModule(eventType) {
  const prefix = String(eventType).split('.')[0];
  return SOURCE_MODULE_BY_PREFIX[prefix] || 'unknown';
}

export function createEnvelopeBuilder() {
  return {
    /**
     * Build a new event envelope.
     *
     * @param {string} eventType
     * @param {object} payload
     * @param {object} [options]
     * @param {string} [options.correlationId]
     * @param {string} [options.actorId]
     * @param {string} [options.workspaceId]
     * @param {string} [options.resourceType]
     * @param {string} [options.resourceId]
     * @param {string} [options.idempotencyKey]
     * @param {string} [options.schemaVersion]
     * @param {string} [options.sourceModule]
     * @param {Date}   [options.occurredAt]
     * @returns {object}
     */
    create(eventType, payload, options = {}) {
      if (!eventType || typeof eventType !== 'string') {
        throw new Error('Event type is required');
      }

      const now = new Date();
      const occurredAt = options.occurredAt || now;

      const envelope = {
        eventId: options.eventId || randomUUID(),
        eventType,
        schemaVersion: options.schemaVersion || DEFAULT_SCHEMA_VERSION,
        occurredAt: occurredAt.toISOString(),
        ingestedAt: now.toISOString(),
        correlationId: options.correlationId || randomUUID(),
        actorId: options.actorId || null,
        workspaceId: options.workspaceId || null,
        resourceType: options.resourceType || eventType.split('.')[0],
        resourceId: String(options.resourceId || ''),
        payload: payload || {},
        idempotencyKey: options.idempotencyKey || null,
        sourceModule: options.sourceModule || deriveSourceModule(eventType),
      };

      return envelope;
    },

    /**
     * Validate an envelope. Throws on invalid.
     */
    validate(envelope) {
      const { error, value } = EventEnvelopeSchema.validate(envelope, {
        abortEarly: false,
        stripUnknown: false,
      });
      if (error) {
        const details = error.details.map((d) => `${d.path.join('.')}: ${d.message}`);
        throw new Error(`Invalid event envelope: ${details.join('; ')}`);
      }
      return value;
    },

    /**
     * Deserialize an envelope from a JSON string, validating on parse.
     */
    fromJson(json) {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      return this.validate(parsed);
    },

    /**
     * Serialize an envelope to JSON.
     */
    toJson(envelope) {
      return JSON.stringify(envelope);
    },
  };
}

export default createEnvelopeBuilder;