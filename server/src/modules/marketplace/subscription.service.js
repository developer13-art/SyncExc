/**
 * SyncExc Server — Marketplace subscription service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createSubscriptionService({ db, queries, stripeMarketplace, events }) {
  async function subscribe({ userId, providerId, planId, workspaceId }) {
    const provider = await queries.findProviderById(providerId);
    if (!provider) throw new NotFoundError('Provider');
    if (provider.moderation_state !== 'approved') {
      throw new ConflictError('Provider is not approved', 'PROVIDER_NOT_APPROVED');
    }
    if (provider.visibility !== 'public') {
      throw new ConflictError('Provider is not accepting subscribers', 'PROVIDER_NOT_PUBLISHED');
    }
    let plan = null;
    if (planId) {
      plan = await queries.findProviderPlanById(planId);
      if (!plan || plan.provider_id !== providerId || plan.status !== 'active') {
        throw new NotFoundError('Subscription plan');
      }
      if (Number(plan.pricing?.amountMinor) !== 0) {
        if (!stripeMarketplace) {
          throw new ConflictError('Stripe marketplace billing is unavailable', 'STRIPE_NOT_CONFIGURED');
        }
      }
    }

    const existing = await queries.findExistingSubscriptionForCheckout(providerId, userId);
    if (existing && ['active', 'trialing'].includes(existing.status)) {
      return existing;
    }
    if (existing?.status === 'past_due') {
      throw new ConflictError(
        'Your subscription payment is past due. Update your payment method before accessing this provider.',
        'SUBSCRIPTION_PAYMENT_PAST_DUE'
      );
    }

    if (plan && Number(plan.pricing?.amountMinor) > 0) {
      return stripeMarketplace.createSubscriptionCheckout({
        userId,
        provider,
        plan,
        workspaceId,
      });
    }

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

      const updated = await queries.updateSubscriptionStatus(subscription.id, 'active', tx);

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
    const subscription = result.rows[0];

    if (
      subscription.stripe_subscription_id &&
      ['active', 'past_due'].includes(subscription.status)
    ) {
      if (subscription.cancel_at_period_end) return subscription;
      if (!stripeMarketplace) {
        throw new ConflictError('Stripe marketplace billing is unavailable', 'STRIPE_NOT_CONFIGURED');
      }
      const updated = await stripeMarketplace.cancelPaidSubscription(subscription);
      await db.tx(async (tx) => {
        await queries.insertSubscriptionEvent(tx, {
          subscriptionId,
          eventType: 'cancellation_scheduled',
        });
      });
      return updated;
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateSubscriptionStatus(subscriptionId, 'canceled', tx);

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