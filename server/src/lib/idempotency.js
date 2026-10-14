/**
 * SyncExc Server — Idempotency service
 *
 * Stores (key, scope, request_hash, response_status, response_body) in
 * Postgres. On a repeat request with the same key and scope:
 *   - if the request hash matches and the original is complete → return cached response
 *   - if the request hash matches and the original is in-flight → return 409
 *   - if the request hash differs → return 409 idempotency conflict
 */

import crypto from 'node:crypto';
import { ConflictError } from './errors.js';
import { createLogger } from './logger.js';

const logger = createLogger({ component: 'idempotency' });

const IN_FLIGHT_TTL_SECONDS = 60 * 60 * 24; // 24h in-flight marker TTL

function hashRequest(body) {
  const normalized = JSON.stringify(body ?? {});
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function createIdempotencyService({ db }) {
  return {
    /**
     * Execute an operation under idempotency.
     *
     * @param {Object} opts
     * @param {string} opts.key            Idempotency key from the client
     * @param {string} opts.scope          Resource namespace (e.g. "orders.submit")
     * @param {string} [opts.actorId]      Requesting user ID
     * @param {string} [opts.workspaceId]  Active workspace ID
     * @param {Object} opts.requestBody    Body for hash comparison
     * @param {() => Promise<{status: number, body: any}>} opts.execute
     * @returns {Promise<{status: number, body: any, replayed: boolean}>}
     */
    async run({ key, scope, actorId, workspaceId, requestBody, execute }) {
      if (!key || typeof key !== 'string' || key.length < 8 || key.length > 256) {
        throw new ConflictError('Missing or invalid idempotency key', 'IDEMPOTENCY_KEY_INVALID');
      }

      const requestHash = hashRequest(requestBody);

      // 1. Attempt to claim the key
      const claim = await db.query(
        `
        INSERT INTO idempotency_keys (key, scope, actor_id, workspace_id, request_hash, state)
        VALUES ($1, $2, $3, $4, $5, 'in_flight')
        ON CONFLICT (key, scope) DO NOTHING
        RETURNING id, state
        `,
        [key, scope, actorId || null, workspaceId || null, requestHash]
      );

      if (claim.rows.length === 0) {
        // 2. Key exists — inspect existing record
        const existing = await db.query(
          `
          SELECT id, state, request_hash, response_status, response_body
          FROM idempotency_keys
          WHERE key = $1 AND scope = $2
          `,
          [key, scope]
        );

        const row = existing.rows[0];
        if (!row) {
          // Extremely unlikely — key vanished between INSERT and SELECT
          throw new ConflictError('Idempotency state unavailable', 'IDEMPOTENCY_STATE_UNAVAILABLE');
        }

        if (row.request_hash !== requestHash) {
          throw new ConflictError('Idempotency key reused with different request', 'IDEMPOTENCY_CONFLICT');
        }

        if (row.state === 'completed') {
          logger.debug({ key, scope }, 'Idempotent replay');
          return {
            status: row.response_status,
            body: row.response_body,
            replayed: true,
          };
        }

        if (row.state === 'in_flight') {
          throw new ConflictError('An identical request is already in progress', 'IDEMPOTENCY_IN_FLIGHT');
        }

        if (row.state === 'failed') {
          // Allow retry of a previously failed operation
          await db.query(
            `UPDATE idempotency_keys SET state = 'in_flight', updated_at = now() WHERE id = $1`,
            [row.id]
          );
        }
      }

      // 3. Run the operation
      let result;
      try {
        result = await execute();
      } catch (err) {
        await db.query(
          `UPDATE idempotency_keys SET state = 'failed', updated_at = now() WHERE key = $1 AND scope = $2`,
          [key, scope]
        );
        throw err;
      }

      // 4. Persist result and mark completed
      await db.query(
        `
        UPDATE idempotency_keys
        SET state = 'completed',
            response_status = $3,
            response_body = $4,
            updated_at = now()
        WHERE key = $1 AND scope = $2
        `,
        [key, scope, result.status, JSON.stringify(result.body ?? null)]
      );

      return { ...result, replayed: false };
    },

    /**
     * Look up the current state of a key without claiming it. Useful for
     * status-polling endpoints.
     */
    async status({ key, scope }) {
      const res = await db.query(
        `
        SELECT state, response_status, response_body, updated_at
        FROM idempotency_keys
        WHERE key = $1 AND scope = $2
        `,
        [key, scope]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        state: row.state,
        status: row.response_status,
        body: row.response_body,
        updatedAt: row.updated_at,
      };
    },

    /**
     * Garbage-collect old keys.
     * Should be called by a scheduled job.
     */
    async purge({ olderThanDays = 30 } = {}) {
      const res = await db.query(
        `
        DELETE FROM idempotency_keys
        WHERE state = 'completed' AND updated_at < now() - ($1 || ' days')::interval
        `,
        [String(olderThanDays)]
      );
      return res.rowCount;
    },
  };
}

export const IDEMPOTENCY_IN_FLIGHT_TTL_SECONDS = IN_FLIGHT_TTL_SECONDS;