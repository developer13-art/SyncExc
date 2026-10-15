/**
 * SyncExc Server — Webhook delivery service
 *
 * Real signed delivery:
 *   - HMAC-SHA256 signature over `{timestamp}.{body}`
 *   - header: X-SyncExc-Signature + X-SyncExc-Timestamp + X-SyncExc-Event-Id
 *   - bounded retry with exponential backoff
 *   - dead-letter after 10 attempts
 *   - suspend subscription after 20 consecutive failures
 */

import { decrypt, signWebhookPayload } from '../../lib/crypto.js';
import { backoffDelay } from '@syncexc/shared';
import { NotFoundError } from '../../lib/errors.js';

const MAX_ATTEMPTS = 10;
const SUSPEND_AFTER_CONSECUTIVE = 20;
const DELIVERY_TIMEOUT_MS = 15000;

export function createWebhookDeliveryService({
  db,
  queries,
  events,
  logger,
}) {
  /**
   * Fan out an event to every active subscription. Creates a delivery row
   * per subscription and enqueues the actual dispatch.
   */
  async function dispatchEvent({ eventType, payload, resourceType, resourceId }) {
    const subscriptions = await queries.listActiveSubscriptionsForEvent(eventType);
    if (subscriptions.length === 0) return { dispatched: 0 };

    // Persist the event once
    const event = await db.tx(async (tx) => {
      return queries.insertWebhookEvent(tx, {
        eventType,
        schemaVersion: 'v1',
        payload,
        resourceType,
        resourceId,
      });
    });

    let dispatched = 0;
    for (const sub of subscriptions) {
      if (sub.application_state !== 'active') continue;

      const delivery = await db.tx(async (tx) => {
        return queries.insertWebhookDelivery(tx, {
          subscriptionId: sub.id,
          eventId: event.id,
          nextRetryAt: new Date(),
        });
      });

      if (delivery) {
        dispatched += 1;
        // Dispatch asynchronously — the runner will also pick this up on
        // the next poll, but we try immediately for latency.
        deliver(delivery.id).catch((err) => {
          logger.debug({ err, deliveryId: delivery.id }, 'Initial delivery attempt failed');
        });
      }
    }

    return { dispatched, eventId: event.id };
  }

  /**
   * Deliver one webhook attempt.
   */
  async function deliver(deliveryId) {
    const delivery = await queries.findWebhookDeliveryById(deliveryId);
    if (!delivery) throw new NotFoundError('Delivery');
    if (delivery.state === 'delivered') return;
    if (delivery.state === 'dead_lettered') return;

    const subscription = await queries.findWebhookSubscriptionById(delivery.subscription_id);
    if (!subscription) {
      await queries.updateWebhookDelivery(deliveryId, { state: 'dead_lettered' });
      return;
    }
    if (subscription.state !== 'active') {
      await queries.updateWebhookDelivery(deliveryId, { state: 'suspended' });
      return;
    }

    const event = await queries.findWebhookEventById(delivery.event_id);
    if (!event) {
      await queries.updateWebhookDelivery(deliveryId, { state: 'dead_lettered' });
      return;
    }

    // Load the signing secret
    const secretEncrypted = await queries.findWebhookDeliveryById(deliveryId); // just to confirm still exists
    const secretResult = await db.query(
      `
      SELECT secret_ref FROM developer_webhook_secret_refs
      WHERE subscription_id = $1
      ORDER BY version DESC
      LIMIT 1
      `,
      [subscription.id]
    );
    if (secretResult.rows.length === 0) {
      await queries.updateWebhookDelivery(deliveryId, {
        state: 'dead_lettered',
        lastResponseStatus: 0,
        lastResponseSnippet: 'signing secret missing',
      });
      return;
    }

    const signingSecret = decrypt(secretResult.rows[0].secret_ref);

    // Build the payload
    const body = JSON.stringify({
      eventId: event.id,
      eventType: event.event_type,
      schemaVersion: event.schema_version,
      occurredAt: event.created_at,
      resourceType: event.resource_type,
      resourceId: event.resource_id,
      payload: event.payload,
    });

    // Sign
    const timestamp = Math.floor(Date.now() / 1000);
    const { signature } = signWebhookPayload(body, signingSecret, timestamp);

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'SyncExc-Webhooks/1.0',
      'X-SyncExc-Event-Id': event.id,
      'X-SyncExc-Event-Type': event.event_type,
      'X-SyncExc-Signature': signature,
      'X-SyncExc-Timestamp': String(timestamp),
      'X-SyncExc-Delivery-Id': delivery.id,
      'X-SyncExc-Attempt': String((delivery.attempt_number || 0) + 1),
    };

    const started = Date.now();
    let responseStatus = 0;
    let responseSnippet = '';
    let errorMessage = null;
    let durationMs = 0;

    try {
      const res = await fetch(subscription.destination_url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });

      responseStatus = res.status;
      const text = await res.text();
      responseSnippet = text.slice(0, 500);
      durationMs = Date.now() - started;

      if (res.status >= 200 && res.status < 300) {
        // Success
        await db.tx(async (tx) => {
          await queries.insertWebhookDeliveryAttempt(tx, {
            deliveryId,
            attemptNumber: (delivery.attempt_number || 0) + 1,
            requestHeaders: headers,
            responseStatus,
            responseBodySnippet: responseSnippet,
            durationMs,
            completedAt: new Date(),
          });

          await queries.updateWebhookDelivery(deliveryId, {
            state: 'delivered',
            attemptNumber: (delivery.attempt_number || 0) + 1,
            lastResponseStatus: responseStatus,
            lastResponseSnippet: responseSnippet,
            deliveredAt: new Date(),
          });

          await queries.updateWebhookSubscription(subscription.id, {
            lastSuccessAt: new Date(),
            consecutiveFailures: 0,
          });
        });

        return { ok: true, status: responseStatus };
      }

      // Non-2xx — treat as failure
      errorMessage = `HTTP ${res.status}`;
    } catch (err) {
      errorMessage = err.message;
      durationMs = Date.now() - started;
    }

    // Record the failed attempt
    const attempts = (delivery.attempt_number || 0) + 1;
    await db.tx(async (tx) => {
      await queries.insertWebhookDeliveryAttempt(tx, {
        deliveryId,
        attemptNumber: attempts,
        requestHeaders: headers,
        responseStatus: responseStatus || null,
        responseBodySnippet: responseSnippet || null,
        durationMs,
        errorMessage,
        completedAt: new Date(),
      });
    });

    if (attempts >= MAX_ATTEMPTS) {
      await queries.updateWebhookDelivery(deliveryId, {
        state: 'dead_lettered',
        attemptNumber: attempts,
        lastResponseStatus: responseStatus || null,
        lastResponseSnippet: responseSnippet || null,
      });

      const updatedSub = await db.query(
        `
        UPDATE developer_webhook_subscriptions
        SET consecutive_failures = consecutive_failures + 1,
            last_failure_at = now(),
            state = CASE
              WHEN consecutive_failures + 1 >= $2 THEN 'suspended'
              ELSE state
            END,
            suspended_at = CASE
              WHEN consecutive_failures + 1 >= $2 THEN now()
              ELSE suspended_at
            END
        WHERE id = $1
        RETURNING *
        `,
        [subscription.id, SUSPEND_AFTER_CONSECUTIVE]
      );

      await events.publish(
        db,
        'developer.webhook_failed',
        {
          deliveryId,
          subscriptionId: subscription.id,
          applicationId: subscription.application_id,
          attempts,
        },
        {
          workspaceId: subscription.workspace_id,
          resourceType: 'webhook_delivery',
          resourceId: deliveryId,
        }
      );

      return { ok: false, deadLettered: true };
    }

    // Schedule a retry
    const nextDelay = backoffDelay(attempts - 1, 1000, 300000);
    const nextRetryAt = new Date(Date.now() + nextDelay);

    await queries.updateWebhookDelivery(deliveryId, {
      state: 'retry_scheduled',
      attemptNumber: attempts,
      nextRetryAt,
      lastResponseStatus: responseStatus || null,
      lastResponseSnippet: responseSnippet || null,
    });

    return { ok: false, retryAt: nextRetryAt };
  }

  /**
   * Process pending deliveries — called by the job runner.
   */
  async function processPending({ limit = 100 } = {}) {
    const pending = await queries.listPendingDeliveries({ limit });
    let processed = 0;
    let delivered = 0;
    let failed = 0;

    for (const delivery of pending) {
      try {
        const result = await deliver(delivery.id);
        processed += 1;
        if (result?.ok) delivered += 1;
        else failed += 1;
      } catch (err) {
        logger.error({ err, deliveryId: delivery.id }, 'Delivery processing failed');
      }
    }

    return { processed, delivered, failed, total: pending.length };
  }

  async function listDeliveries({ subscriptionId, workspaceId, limit }) {
    const sub = await queries.findWebhookSubscriptionById(subscriptionId);
    if (!sub || sub.workspace_id !== workspaceId) throw new NotFoundError('Subscription');
    return queries.listDeliveriesForSubscription(subscriptionId, { limit });
  }

  async function getDelivery({ deliveryId, workspaceId }) {
    const delivery = await queries.findWebhookDeliveryById(deliveryId);
    if (!delivery) throw new NotFoundError('Delivery');
    const sub = await queries.findWebhookSubscriptionById(delivery.subscription_id);
    if (!sub || sub.workspace_id !== workspaceId) throw new NotFoundError('Delivery');

    const attempts = await queries.listWebhookDeliveryAttempts(deliveryId);
    return { delivery, attempts };
  }

  /**
   * Replay an eligible delivery. Preserves the original event ID; enqueues a
   * new attempt log entry with a replay marker.
   */
  async function replayDelivery({ userId, workspaceId, deliveryId }) {
    const delivery = await queries.findWebhookDeliveryById(deliveryId);
    if (!delivery) throw new NotFoundError('Delivery');

    const sub = await queries.findWebhookSubscriptionById(delivery.subscription_id);
    if (!sub || sub.workspace_id !== workspaceId) throw new NotFoundError('Delivery');

    // Reset the delivery state to allow a fresh attempt, but keep attempt counter
    await queries.updateWebhookDelivery(deliveryId, {
      state: 'retry_scheduled',
      nextRetryAt: new Date(),
    });

    await db.tx(async (tx) => {
      await queries.insertAuditEvent(tx, {
        actorId: userId,
        applicationId: sub.application_id,
        action: 'webhook.replay_requested',
        resourceType: 'webhook_delivery',
        resourceId: deliveryId,
      });
    });

    deliver(deliveryId).catch((err) => {
      logger.debug({ err, deliveryId }, 'Replay dispatch failed');
    });

    return { ok: true };
  }

  return {
    dispatchEvent,
    deliver,
    processPending,
    listDeliveries,
    getDelivery,
    replayDelivery,
  };
}

export default createWebhookDeliveryService;