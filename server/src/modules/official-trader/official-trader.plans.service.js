/**
 * SyncExc Server — Official AI Trader marketplace plans service
 *
 * Lets authorised administrators manage the subscription plans offered by the
 * platform-owned Official SyncExc AI Trader provider: setting the subscription
 * fee, creating new plans, and activating or retiring them. Paid plans are
 * billed through Flutterwave; activating a paid plan requires Flutterwave
 * marketplace billing (and webhook verification) to be configured. Changing a
 * paid plan's pricing detaches any previously created Flutterwave payment
 * plan so the next checkout creates one at the new amount — existing
 * subscribers keep their own provider-side recurring subscription untouched.
 */

import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';

const PLAN_STATUSES = ['draft', 'active', 'retired', 'archived'];
const PAID_SUBSCRIPTION_STATUSES = ['active', 'past_due'];
const BILLING_INTERVALS = ['monthly', 'yearly'];
const BILLING_CURRENCIES = ['NGN', 'USD'];

const PLAN_TRANSITIONS = {
  draft: ['active', 'archived'],
  active: ['retired'],
  retired: ['active', 'archived'],
  archived: [],
};

export function createOfficialTraderPlansService({
  db,
  queries,
  config,
  logger,
  getProvider,
  recordEvent,
  audit,
  notifyAdmins,
}) {
  function normalizePricing(pricing) {
    const amountMinor = Number(pricing?.amountMinor);
    const currency = String(pricing?.currency || '').trim().toUpperCase();
    const billingInterval = String(pricing?.billingInterval || '').trim().toLowerCase();

    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
      throw new ValidationError('Plan price must be a non-negative whole-number amount in minor units');
    }
    if (!BILLING_CURRENCIES.includes(currency)) {
      throw new ValidationError(`Plan currency must be one of: ${BILLING_CURRENCIES.join(', ')}`);
    }
    if (!BILLING_INTERVALS.includes(billingInterval)) {
      throw new ValidationError(`Plan billing interval must be one of: ${BILLING_INTERVALS.join(', ')}`);
    }
    return { amountMinor, currency, billingInterval };
  }

  function assertFlutterwaveConfigured() {
    const flutterwave = config?.payments?.flutterwave;
    if (
      !flutterwave?.enabled ||
      !flutterwave.secretKey ||
      !flutterwave.webhookSecret
    ) {
      throw new ConflictError(
        'Flutterwave marketplace billing and webhook verification are not configured',
        'FLUTTERWAVE_NOT_CONFIGURED',
      );
    }
  }

  async function createPlan({ actorId, name, pricing, entitlements, reason }) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider is not provisioned');

    const trimmedName = String(name || '').trim();
    if (trimmedName.length < 3 || trimmedName.length > 100) {
      throw new ValidationError('Plan name must be between 3 and 100 characters');
    }
    const normalizedPricing = normalizePricing(pricing);

    const plan = await db.tx(async (tx) => {
      const inserted = await queries.insertProviderPlan({
        providerId: provider.id,
        name: trimmedName,
        pricing: normalizedPricing,
        entitlements: entitlements || {},
      }, tx);
      const versioned = { ...inserted, version: 1 };
      await queries.insertProviderPlanVersion(versioned, tx);
      return versioned;
    });

    await recordEvent({
      providerId: provider.id,
      eventType: 'marketplace.plan_created',
      message: `Official subscription plan "${plan.name}" created (${describePricing(plan.pricing)})`,
      metadata: { planId: plan.id, pricing: plan.pricing },
    });
    await audit({
      actorId,
      action: 'official_trader.plan_created',
      targetResource: 'marketplace_provider_plan',
      targetId: plan.id,
      reason,
      after: { name: plan.name, pricing: plan.pricing, entitlements: plan.entitlements },
    });

    return plan;
  }

  async function updatePlan({ actorId, planId, name, pricing, entitlements, reason }) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider is not provisioned');
    const plan = await queries.getProviderPlan(provider.id, planId);
    if (!plan) throw new NotFoundError('Official subscription plan');

    if (plan.status === 'retired' || plan.status === 'archived') {
      throw new ConflictError(
        'A retired or archived plan cannot be edited. Create a new plan instead.',
        'INVALID_PLAN_STATE',
      );
    }

    const fields = {};
    if (name !== undefined) {
      const trimmedName = String(name || '').trim();
      if (trimmedName.length < 3 || trimmedName.length > 100) {
        throw new ValidationError('Plan name must be between 3 and 100 characters');
      }
      fields.name = trimmedName;
    }
    if (pricing !== undefined) {
      fields.pricing = normalizePricing(pricing);
    }
    if (entitlements !== undefined) {
      if (!entitlements || typeof entitlements !== 'object' || Array.isArray(entitlements)) {
        throw new ValidationError('Plan entitlements must be an object');
      }
      fields.entitlements = entitlements;
    }
    if (Object.keys(fields).length === 0) {
      throw new ValidationError('Nothing to update');
    }

    const pricingChanged =
      fields.pricing &&
      JSON.stringify(fields.pricing) !== JSON.stringify(plan.pricing);

    if (plan.status === 'active' && pricingChanged && Number(fields.pricing.amountMinor) > 0) {
      // Existing subscribers keep their own Flutterwave recurring plan; only
      // future checkouts are affected, so a pricing change is safe once the
      // stored Flutterwave payment plan is detached below.
      assertFlutterwaveConfigured();
    }

    const updated = await db.tx(async (tx) => {
      const changed = await queries.updateProviderPlan(
        plan.id,
        {
          ...fields,
          // Detach any previously created Flutterwave payment plan so the next
          // checkout creates one at the new amount.
          ...(pricingChanged ? { flutterwavePaymentPlanId: null } : {}),
        },
        tx,
      );
      const versioned = { ...changed, version: Number(plan.version || 1) + 1 };
      await queries.insertProviderPlanVersion(versioned, tx);
      return versioned;
    });

    await recordEvent({
      providerId: provider.id,
      eventType: 'marketplace.plan_updated',
      message: `Official subscription plan "${updated.name}" updated (${describePricing(updated.pricing)})`,
      metadata: {
        planId: updated.id,
        before: { name: plan.name, pricing: plan.pricing },
        after: { name: updated.name, pricing: updated.pricing },
      },
    });
    await audit({
      actorId,
      action: 'official_trader.plan_updated',
      targetResource: 'marketplace_provider_plan',
      targetId: updated.id,
      reason,
      before: { name: plan.name, pricing: plan.pricing, entitlements: plan.entitlements },
      after: { name: updated.name, pricing: updated.pricing, entitlements: updated.entitlements },
    });

    return updated;
  }

  async function setPlanStatus({ actorId, planId, status, reason }) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider is not provisioned');
    const plan = await queries.getProviderPlan(provider.id, planId);
    if (!plan) throw new NotFoundError('Official subscription plan');

    const allowed = PLAN_TRANSITIONS[plan.status] || [];
    if (!allowed.includes(status)) {
      throw new ConflictError(
        `Plan cannot transition from ${plan.status} to ${status}`,
        'INVALID_PLAN_STATE',
      );
    }

    if (status === 'active') {
      if (provider.moderation_state !== 'approved' || provider.visibility !== 'public') {
        throw new ConflictError(
          'An approved, public official profile is required to activate a plan',
          'PROFILE_NOT_PUBLISHED',
        );
      }
      if (Number(plan.pricing?.amountMinor) > 0) {
        assertFlutterwaveConfigured();
      }
    }

    const updated = await db.tx(async (tx) => {
      const changed = await queries.updateProviderPlanStatus(plan.id, status, tx);
      const versioned = { ...changed, version: Number(plan.version || 1) + 1 };
      await queries.insertProviderPlanVersion(versioned, tx);
      return versioned;
    });

    await recordEvent({
      providerId: provider.id,
      eventType: 'marketplace.plan_status_changed',
      message: `Official subscription plan "${updated.name}" moved from ${plan.status} to ${updated.status}`,
      metadata: { planId: updated.id, previousStatus: plan.status, status: updated.status },
    });
    await audit({
      actorId,
      action: 'official_trader.plan_status_changed',
      targetResource: 'marketplace_provider_plan',
      targetId: updated.id,
      reason,
      before: { status: plan.status },
      after: { status: updated.status },
    });
    if (status === 'retired') {
      await notifyAdmins({
        eventType: 'official_trader_plan_retired',
        title: 'Official trader plan retired',
        message: `The official subscription plan "${updated.name}" was retired. New subscribers can no longer select it.`,
        action: { label: 'Review plans', path: '/official-trader/marketplace' },
      });
    }

    return updated;
  }

  return {
    createPlan,
    updatePlan,
    setPlanStatus,
  };
}

function describePricing(pricing) {
  const amountMinor = Number(pricing?.amountMinor ?? 0);
  if (!amountMinor) return 'free';
  return `${(amountMinor / 100).toFixed(2)} ${pricing.currency} / ${pricing.billingInterval}`;
}

export default createOfficialTraderPlansService;
