/**
 * SyncExc Server — Marketplace subscription service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createSubscriptionService({ db, queries, billing, events, logger }) {
  async function subscribe({ userId, providerId, planId, workspaceId }) {
    const provider = await queries.findProviderById(providerId);
    if (!provider) throw new NotFoundError('Provider');
    if (provider.moderation_state !== 'approved') {
      throw new ConflictError('Provider is not approved', 'PROVIDER_NOT_APPROVED');
    }
    if (provider.visibility !== 'public') {
      throw new ConflictError('Provider is not accepting subscribers', 'PROVIDER_NOT_PUBLISHED');
    }
    if (planId) {
      const plan = await queries.findProviderPlanById(planId);
      if (!plan || plan.provider_id !== providerId || plan.status !== 'active') {
        throw new NotFoundError('Subscription plan');
      }
      if (Number(plan.pricing?.amountMinor) !== 0) {
        throw new ConflictError(
          'Paid subscription checkout is not available',
          'PAID_SUBSCRIPTIONS_UNAVAILABLE',
        );
      }
    }

    const existing = await queries.findActiveSubscription(providerId, userId);
    if (existing) throw new ConflictError('Subscription already active', 'SUBSCRIPTION_EXISTS');

    return db.tx(async (tx) => {
      const subscription = await queries.insertSubscription(tx, {
        providerId,
        planId,
        subscriberUserId: userId,
        workspaceId,
      });

      await queries.insertSubscriptionEvent(tx, {
        subscriptionId: subscription.id,
        eventType: 'created',
      });

      // In production, this would trigger a billing flow through the billing
      // module. For now, activate immediately.
      const updated = await queries.updateSubscriptionStatus(subscription.id, 'active');

      await events.publish(
        tx,
        'marketplace.subscription_started',
        { subscriptionId: subscription.id, providerId, userId },
        {
          actorId: userId,
          resourceType: 'marketplace_subscription',
          resourceId: subscription.id,
        }
      );

      return updated;
    });
  }

  async function cancel({ userId, subscriptionId }) {
    const result = await db.query(
      `SELECT * FROM marketplace_subscriptions WHERE id = $1 AND subscriber_user_id = $2`,
      [subscriptionId, userId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Subscription');

    return db.tx(async (tx) => {
      const updated = await queries.updateSubscriptionStatus(subscriptionId, 'canceled');

      await queries.insertSubscriptionEvent(tx, {
        subscriptionId,
        eventType: 'canceled',
      });

      return updated;
    });
  }

  async function listSubscriptions({ userId }) {
    return queries.listSubscriptionsForUser(userId);
  }

  async function getSubscription({ userId, providerId }) {
    return queries.findActiveSubscription(providerId, userId);
  }

  return {
    subscribe,
    cancel,
    listSubscriptions,
    getSubscription,
  };
}

export default createSubscriptionService;