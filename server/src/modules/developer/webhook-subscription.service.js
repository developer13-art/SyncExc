/**
 * SyncExc Server — Webhook subscription service
 */

import { randomBytes } from 'node:crypto';
import { encrypt } from '../../lib/crypto.js';
import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';

const DELIVERABLE_EVENTS = [
  'order.accepted',
  'order.filled',
  'order.partially_filled',
  'order.cancelled',
  'order.rejected',
  'position.updated',
  'sync.completed',
  'sync.partially_completed',
  'sync.reconciliation_required',
  'signal.received',
  'signal.validated',
  'automation.run_completed',
  'automation.run_failed',
  'subscription.status_changed',
  'payment.succeeded',
  'developer.credential_revoked',
  'developer.application_suspended',
];

export function createWebhookSubscriptionService({ db, queries, events, logger }) {
  async function createSubscription({
    userId,
    workspaceId,
    applicationId,
    destinationUrl,
    eventTypes,
    resourceFilters,
  }) {
    const app = await queries.findApplicationById(applicationId);
    if (!app || app.workspace_id !== workspaceId) throw new NotFoundError('Application');
    if (app.state !== 'active' && app.state !== 'draft') {
      throw new ConflictError('Application is not active', 'APP_NOT_ACTIVE');
    }

    if (!Array.isArray(eventTypes) || eventTypes.length === 0) {
      throw new ValidationError('At least one event type is required');
    }
    const invalid = eventTypes.filter((e) => !DELIVERABLE_EVENTS.includes(e));
    if (invalid.length > 0) {
      throw new ValidationError(`Invalid event types: ${invalid.join(', ')}`);
    }

    // Verify the destination URL is reachable and HTTPS
    await verifyDestinationUrl(destinationUrl);

    // Generate a signing secret
    const signingSecret = `whsec_${randomBytes(32).toString('base64url')}`;
    const encryptedSecret = encrypt(signingSecret);
    const signingSecretRef = `whsec_ref_${randomBytes(8).toString('hex')}`;

    return db.tx(async (tx) => {
      // Store encrypted secret in the credentials table (reuse pattern)
      const subscription = await queries.insertWebhookSubscription(tx, {
        applicationId,
        workspaceId,
        destinationUrl,
        eventTypes,
        resourceFilters,
        signingSecretRef,
      });

      await queries.insertWebhookSecretRef(tx, {
        subscriptionId: subscription.id,
        secretRef: encryptedSecret,
        version: 1,
      });

      await queries.insertAuditEvent(tx, {
        actorId: userId,
        applicationId,
        action: 'webhook.subscribed',
        resourceType: 'webhook_subscription',
        resourceId: subscription.id,
        after: { destinationUrl, eventTypes },
      });

      await events.publish(
        tx,
        'developer.webhook_subscribed',
        { subscriptionId: subscription.id, applicationId, eventTypes },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'webhook_subscription',
          resourceId: subscription.id,
        }
      );

      return {
        subscription,
        signingSecret, // shown once
      };
    });
  }

  async function verifyDestinationUrl(url) {
    if (!url || !url.startsWith('https://')) {
      throw new ValidationError('Webhook destination must be an HTTPS URL');
    }
    // Block localhost / private ranges by simple string checks (defends
    // against SSRF that would route internal traffic).
    const lower = url.toLowerCase();
    if (
      lower.includes('localhost') ||
      lower.includes('127.0.0.1') ||
      lower.includes('0.0.0.0') ||
      lower.match(/https?:\/\/10\./) ||
      lower.match(/https?:\/\/192\.168\./) ||
      lower.match(/https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
      lower.includes('169.254.')
    ) {
      throw new ValidationError('Webhook destination points to an internal address');
    }

    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      if (res.status >= 500) {
        logger.warn({ url, status: res.status }, 'Webhook destination returned server error');
      }
    } catch (err) {
      logger.warn({ url, err: err.message }, 'Webhook destination reachability check failed');
      // Don't block — endpoints might not accept HEAD
    }
  }

  async function listSubscriptions({ applicationId, workspaceId }) {
    const app = await queries.findApplicationById(applicationId);
    if (!app || app.workspace_id !== workspaceId) throw new NotFoundError('Application');
    return queries.listWebhookSubscriptionsForApplication(applicationId);
  }

  async function getSubscription({ subscriptionId, workspaceId }) {
    const sub = await queries.findWebhookSubscriptionById(subscriptionId);
    if (!sub || sub.workspace_id !== workspaceId) throw new NotFoundError('Subscription');
    return sub;
  }

  async function updateSubscription({ userId, workspaceId, subscriptionId, updates }) {
    const sub = await queries.findWebhookSubscriptionById(subscriptionId);
    if (!sub || sub.workspace_id !== workspaceId) throw new NotFoundError('Subscription');

    if (updates.destinationUrl && updates.destinationUrl !== sub.destination_url) {
      await verifyDestinationUrl(updates.destinationUrl);
    }

    return queries.updateWebhookSubscription(subscriptionId, updates);
  }

  async function deleteSubscription({ userId, workspaceId, subscriptionId }) {
    const sub = await queries.findWebhookSubscriptionById(subscriptionId);
    if (!sub || sub.workspace_id !== workspaceId) throw new NotFoundError('Subscription');
    return queries.updateWebhookSubscription(subscriptionId, { state: 'revoked' });
  }

  async function rotateSecret({ userId, workspaceId, subscriptionId }) {
    const sub = await queries.findWebhookSubscriptionById(subscriptionId);
    if (!sub || sub.workspace_id !== workspaceId) throw new NotFoundError('Subscription');

    const newSecret = `whsec_${randomBytes(32).toString('base64url')}`;
    const encrypted = encrypt(newSecret);

    await db.tx(async (tx) => {
      await queries.insertWebhookSecretRef(tx, {
        subscriptionId,
        secretRef: encrypted,
        version: 2,
      });
    });

    return { signingSecret: newSecret };
  }

  async function getSigningSecret({ subscriptionId }) {
    const result = await db.query(
      `
      SELECT secret_ref FROM developer_webhook_secret_refs
      WHERE subscription_id = $1
      ORDER BY version DESC
      LIMIT 1
      `,
      [subscriptionId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Signing secret');
    return result.rows[0].secret_ref;
  }

  return {
    createSubscription,
    listSubscriptions,
    getSubscription,
    updateSubscription,
    deleteSubscription,
    rotateSecret,
    getSigningSecret,
    DELIVERABLE_EVENTS,
  };
}

export default createWebhookSubscriptionService;