import {
  ConflictError,
  ExternalProviderError,
} from '../../lib/errors.js';

const INTERVAL_MAP = {
  monthly: 'month',
  yearly: 'year',
};

export function createStripeMarketplaceService({
  db,
  queries,
  providerService,
  config,
  logger,
  stripeClient: suppliedStripeClient,
}) {
  let stripeClient = suppliedStripeClient;

  async function getStripe() {
    if (stripeClient) return stripeClient;
    const stripeConfig = config?.payments?.stripe;
    if (!stripeConfig?.enabled || !stripeConfig.secretKey) {
      throw new ConflictError('Stripe marketplace payments are not configured', 'STRIPE_NOT_CONFIGURED');
    }

    let Stripe;
    try {
      Stripe = (await import('stripe')).default;
    } catch (error) {
      throw new Error('Stripe SDK is required for marketplace payments', { cause: error });
    }
    stripeClient = new Stripe(stripeConfig.secretKey, { apiVersion: '2024-06-20' });
    return stripeClient;
  }

  function serializePayoutStatus(provider) {
    const platformFeePercent = Number(config?.marketplace?.platformFeePercent ?? 2);
    if (!provider?.stripe_connect_account_id) {
      return {
        status: 'not_connected',
        detailsSubmitted: false,
        payoutsEnabled: false,
        platformFeePercent,
      };
    }
    const ready = provider.stripe_details_submitted && provider.stripe_transfers_enabled &&
      provider.stripe_payouts_enabled;
    return {
      status: ready ? 'ready' : 'onboarding_required',
      detailsSubmitted: Boolean(provider.stripe_details_submitted),
      transfersEnabled: Boolean(provider.stripe_transfers_enabled),
      payoutsEnabled: Boolean(provider.stripe_payouts_enabled),
      country: provider.stripe_country || null,
      platformFeePercent,
    };
  }

  async function startPayoutOnboarding({ userId, workspaceId, country }) {
    const provider = await providerService.getManagedProvider({ userId, workspaceId });
    const stripe = await getStripe();
    let accountId = provider.stripe_connect_account_id;
    if (accountId && provider.stripe_country !== country) {
      throw new ConflictError('The connected account country cannot be changed', 'STRIPE_COUNTRY_MISMATCH');
    }

    if (!accountId) {
      let account;
      try {
        account = await stripe.accounts.create(
          {
            type: 'express',
            country,
            capabilities: { transfers: { requested: true } },
          },
          { idempotencyKey: `marketplace-connect:${provider.id}` }
        );
      } catch (error) {
        logger?.error?.({ errorName: error.name || 'Error', providerId: provider.id }, 'Stripe Connect account creation failed');
        if (error instanceof ConflictError) throw error;
        throw new ExternalProviderError('Stripe could not create the payout account. Please try again later.', {
          provider: 'stripe',
          status: 502,
          retryable: true,
          details: { stage: 'connected account creation' },
        });
      }
      accountId = account.id;
      await queries.updateProviderStripeAccount(provider.id, {
        accountId,
        country,
        detailsSubmitted: account.details_submitted,
        transfersEnabled: account.capabilities?.transfers?.status === 'active',
        payoutsEnabled: account.payouts_enabled,
      });
    }

    let account;
    try {
      account = await stripe.accounts.retrieve(accountId);
    } catch (error) {
      logger?.error?.({ errorName: error.name || 'Error', providerId: provider.id }, 'Stripe Connect account lookup failed');
      throw new ExternalProviderError('Stripe could not verify the payout account.', {
        provider: 'stripe',
        status: 502,
        retryable: true,
        details: { stage: 'connected account lookup' },
      });
    }
    const updatedProvider = await queries.updateProviderStripeAccount(provider.id, {
      detailsSubmitted: account.details_submitted,
      transfersEnabled: account.capabilities?.transfers?.status === 'active',
      payoutsEnabled: account.payouts_enabled,
    });

    try {
      const baseUrl = config.app.url.replace(/\/+$/, '');
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/app/trader/revenue?connect=refresh`,
        return_url: `${baseUrl}/app/trader/revenue?connect=return`,
        type: 'account_onboarding',
      });
      return { url: link.url, ...serializePayoutStatus(updatedProvider) };
    } catch (error) {
      logger?.error?.({ errorName: error.name || 'Error', providerId: provider.id }, 'Stripe Connect onboarding link creation failed');
      throw new ExternalProviderError('Stripe could not start payout onboarding. Please try again later.', {
        provider: 'stripe',
        status: 502,
        retryable: true,
        details: { stage: 'onboarding link creation' },
      });
    }
  }

  async function getPayoutStatus({ userId, workspaceId }) {
    const provider = await providerService.getManagedProvider({ userId, workspaceId });
    if (!provider.stripe_connect_account_id) return serializePayoutStatus(provider);
    const stripe = await getStripe();
    let account;
    try {
      account = await stripe.accounts.retrieve(provider.stripe_connect_account_id);
    } catch (error) {
      logger?.error?.({ errorName: error.name || 'Error', providerId: provider.id }, 'Stripe Connect status lookup failed');
      throw new ExternalProviderError('Stripe could not retrieve the payout account status.', {
        provider: 'stripe',
        status: 502,
        retryable: true,
        details: { stage: 'connected account status' },
      });
    }
    const updated = await queries.updateProviderStripeAccount(provider.id, {
      detailsSubmitted: account.details_submitted,
      transfersEnabled: account.capabilities?.transfers?.status === 'active',
      payoutsEnabled: account.payouts_enabled,
    });
    return serializePayoutStatus(updated);
  }

  async function createSubscriptionCheckout({ userId, provider, plan, workspaceId }) {
    const stripe = await getStripe();
    if (!config?.payments?.stripe?.webhookSecret) {
      throw new ConflictError('Stripe marketplace webhook signing is not configured', 'STRIPE_WEBHOOK_NOT_CONFIGURED');
    }
    let freshProvider = await queries.findProviderById(provider.id);
    if (freshProvider?.stripe_connect_account_id) {
      let account;
      try {
        account = await stripe.accounts.retrieve(freshProvider.stripe_connect_account_id);
      } catch (error) {
        logger?.error?.({ errorName: error.name || 'Error', providerId: provider.id }, 'Stripe payout readiness check failed');
        throw new ExternalProviderError('Stripe could not verify the Trader payout account.', {
          provider: 'stripe',
          status: 502,
          retryable: true,
          details: { stage: 'payout readiness' },
        });
      }
      freshProvider = await queries.updateProviderStripeAccount(provider.id, {
        detailsSubmitted: account.details_submitted,
        transfersEnabled: account.capabilities?.transfers?.status === 'active',
        payoutsEnabled: account.payouts_enabled,
      });
    }
    if (
      !freshProvider?.stripe_connect_account_id ||
      !freshProvider.stripe_details_submitted ||
      !freshProvider.stripe_transfers_enabled ||
      !freshProvider.stripe_payouts_enabled
    ) {
      throw new ConflictError('This Trader has not completed Stripe payout setup', 'PROVIDER_PAYOUTS_NOT_READY');
    }

    const interval = INTERVAL_MAP[plan.pricing?.billingInterval];
    const amountMinor = Number(plan.pricing?.amountMinor);
    if (!interval || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new ConflictError('The subscription plan has invalid pricing', 'INVALID_PLAN_PRICING');
    }

    const existing = await queries.findPendingSubscription(provider.id, userId);
    let subscription = existing;
    if (existing) {
      if (existing.plan_id !== plan.id) {
        throw new ConflictError('Another subscription checkout is already pending', 'CHECKOUT_IN_PROGRESS');
      }
      if (existing.stripe_checkout_url) {
        return {
          subscriptionId: existing.id,
          redirectUrl: existing.stripe_checkout_url,
        };
      }
    }

    if (!subscription) {
      try {
        subscription = await db.tx(async (tx) => {
          const created = await queries.insertSubscription(tx, {
            providerId: provider.id,
            planId: plan.id,
            subscriberUserId: userId,
            workspaceId,
          });
          await queries.insertSubscriptionEvent(tx, {
            subscriptionId: created.id,
            eventType: 'checkout_started',
            metadata: { planId: plan.id },
          });
          return created;
        });
      } catch (error) {
        if (error.code !== '23505') throw error;
        const pending = await queries.findPendingSubscription(provider.id, userId);
        if (pending?.plan_id === plan.id && pending.stripe_checkout_url) {
          return { subscriptionId: pending.id, redirectUrl: pending.stripe_checkout_url };
        }
        throw new ConflictError('Another subscription checkout is already being prepared', 'CHECKOUT_IN_PROGRESS');
      }
    }

    const emailResult = await db.query(`SELECT email FROM users WHERE id = $1`, [userId]);
    const subscriberEmail = emailResult.rows[0]?.email || undefined;
    const baseUrl = config.app.url.replace(/\/+$/, '');
    const platformFeePercent = Number(config?.marketplace?.platformFeePercent ?? 2);

    let session;
    try {
      session = await stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          success_url: `${baseUrl}/app/marketplace/subscriptions?checkout=success&subscriptionId=${subscription.id}`,
          cancel_url: `${baseUrl}/app/marketplace/providers/${provider.id}?checkout=cancelled`,
          customer_email: subscriberEmail,
          line_items: [{
            price_data: {
              currency: plan.pricing.currency.toLowerCase(),
              unit_amount: amountMinor,
              product_data: { name: `${provider.display_name} — ${plan.name}` },
              recurring: { interval },
            },
            quantity: 1,
          }],
          metadata: {
            marketplaceSubscriptionId: subscription.id,
            providerId: provider.id,
            planId: plan.id,
          },
          subscription_data: {
            transfer_data: { destination: freshProvider.stripe_connect_account_id },
            ...(platformFeePercent > 0
              ? { application_fee_percent: platformFeePercent }
              : {}),
            metadata: {
              marketplaceSubscriptionId: subscription.id,
              providerId: provider.id,
              planId: plan.id,
            },
          },
        },
        { idempotencyKey: `marketplace-checkout:${subscription.id}` }
      );
    } catch (error) {
      await db.tx(async (tx) => {
        await queries.updateMarketplaceSubscription(subscription.id, {
          status: 'expired',
        }, tx);
        await queries.insertSubscriptionEvent(tx, {
          subscriptionId: subscription.id,
          eventType: 'checkout_failed',
        });
      });
      logger?.error?.({ errorName: error.name || 'Error', subscriptionId: subscription.id }, 'Stripe subscription checkout failed');
      throw new ExternalProviderError('Stripe could not start subscription checkout. Please try again later.', {
        provider: 'stripe',
        status: 502,
        retryable: true,
        details: { stage: 'subscription checkout' },
      });
    }

    if (!session?.id || !session.url) {
      throw new ExternalProviderError('Stripe returned an incomplete subscription checkout session.', {
        provider: 'stripe',
        status: 502,
        retryable: true,
        details: { stage: 'subscription checkout response' },
      });
    }
    await queries.updateMarketplaceSubscription(subscription.id, {
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
    });
    return { subscriptionId: subscription.id, redirectUrl: session.url };
  }

  async function cancelPaidSubscription(subscription) {
    const stripe = await getStripe();
    try {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    } catch (error) {
      logger?.error?.({ errorName: error.name || 'Error', subscriptionId: subscription.id }, 'Stripe subscription cancellation failed');
      throw new ExternalProviderError('Stripe could not schedule subscription cancellation.', {
        provider: 'stripe',
        status: 502,
        retryable: true,
        details: { stage: 'subscription cancellation' },
      });
    }
    return queries.updateMarketplaceSubscription(subscription.id, {
      cancelAtPeriodEnd: true,
      canceledAt: new Date(),
    });
  }

  async function handleWebhook({ event }) {
    if (!event?.id || !event?.type) {
      throw new ConflictError('Invalid Stripe webhook event', 'INVALID_WEBHOOK_EVENT');
    }

    return db.tx(async (tx) => {
      const inserted = await queries.insertMarketplaceStripeWebhookEvent(tx, {
        eventId: event.id,
        eventType: event.type,
      });
      if (!inserted) return { handled: true, duplicate: true };

      const object = event.data?.object || {};
      switch (event.type) {
        case 'account.updated': {
          const provider = await queries.findProviderByStripeAccountId(object.id, tx);
          if (provider) {
            await queries.updateProviderStripeAccount(provider.id, {
              detailsSubmitted: object.details_submitted,
              transfersEnabled: object.capabilities?.transfers?.status === 'active',
              payoutsEnabled: object.payouts_enabled,
            }, tx);
          }
          break;
        }
        case 'checkout.session.completed': {
          const subscriptionId = object.metadata?.marketplaceSubscriptionId;
          if (subscriptionId) {
            await queries.updateMarketplaceSubscription(subscriptionId, {
              checkoutSessionId: object.id,
              customerId: stripeId(object.customer),
              stripeSubscriptionId: stripeId(object.subscription),
            }, tx);
          }
          break;
        }
        case 'checkout.session.expired': {
          const subscriptionId = object.metadata?.marketplaceSubscriptionId;
          if (subscriptionId) {
            await updateSubscriptionFromWebhook(tx, subscriptionId, {
              status: 'expired',
            }, 'checkout_expired');
          }
          break;
        }
        case 'invoice.paid': {
          const stripeSubscriptionId = getInvoiceSubscriptionId(object);
          if (stripeSubscriptionId) {
            const subscription = await findMarketplaceSubscription(
              tx,
              stripeSubscriptionId,
              getMarketplaceSubscriptionId(object)
            );
            if (subscription) {
              const period = object.lines?.data?.find((line) => line.type === 'subscription')?.period ||
                object.lines?.data?.[0]?.period ||
                {};
              await updateSubscriptionFromWebhook(tx, subscription.id, {
                status: 'active',
                stripeSubscriptionId,
                currentPeriodStart: unixDate(period.start),
                currentPeriodEnd: unixDate(period.end),
              }, 'payment_succeeded');
            }
          }
          break;
        }
        case 'invoice.payment_failed': {
          const stripeSubscriptionId = getInvoiceSubscriptionId(object);
          if (stripeSubscriptionId) {
            const subscription = await findMarketplaceSubscription(
              tx,
              stripeSubscriptionId,
              getMarketplaceSubscriptionId(object)
            );
            if (subscription) {
              await updateSubscriptionFromWebhook(tx, subscription.id, {
                status: 'past_due',
                stripeSubscriptionId,
              }, 'payment_failed');
            }
          }
          break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = await findMarketplaceSubscription(
            tx,
            object.id,
            getMarketplaceSubscriptionId(object)
          );
          if (subscription) {
            const status = event.type === 'customer.subscription.deleted'
              ? 'canceled'
              : mapStripeSubscriptionStatus(object.status, subscription.status);
            await updateSubscriptionFromWebhook(tx, subscription.id, {
              status,
              stripeSubscriptionId: object.id,
              currentPeriodStart: unixDate(object.current_period_start),
              currentPeriodEnd: unixDate(object.current_period_end),
              cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
              canceledAt: object.canceled_at ? unixDate(object.canceled_at) : null,
            }, event.type);
          }
          break;
        }
        default:
          break;
      }
      return { handled: true };
    });
  }

  async function updateSubscriptionFromWebhook(tx, subscriptionId, fields, eventType) {
    const current = await queries.findSubscriptionById(subscriptionId, tx);
    if (!current) return;
    const terminalStatuses = ['canceled', 'expired', 'suspended', 'access_revoked'];
    if (
      terminalStatuses.includes(current.status) &&
      !terminalStatuses.includes(fields.status)
    ) {
      return;
    }
    if (current.status === 'past_due' && fields.status === 'subscription_pending') return;
    if (fields.status === 'expired' && current.status !== 'subscription_pending') return;

    const updated = await queries.updateMarketplaceSubscription(subscriptionId, fields, tx);
    if (!updated) return;
    await queries.insertSubscriptionEvent(tx, {
      subscriptionId,
      eventType,
      metadata: { source: 'stripe_webhook' },
    });
  }

  async function findMarketplaceSubscription(tx, stripeSubscriptionId, marketplaceSubscriptionId) {
    const byStripeId = await queries.findSubscriptionByStripeId(stripeSubscriptionId, tx);
    if (byStripeId || !marketplaceSubscriptionId) return byStripeId;
    return queries.findSubscriptionById(marketplaceSubscriptionId, tx);
  }

  function getInvoiceSubscriptionId(invoice) {
    return stripeId(invoice.subscription) ||
      stripeId(invoice.parent?.subscription_details?.subscription) ||
      stripeId(invoice.subscription_details?.subscription);
  }

  function getMarketplaceSubscriptionId(object) {
    return object.metadata?.marketplaceSubscriptionId ||
      object.parent?.subscription_details?.metadata?.marketplaceSubscriptionId ||
      object.subscription_details?.metadata?.marketplaceSubscriptionId ||
      null;
  }

  return {
    startPayoutOnboarding,
    getPayoutStatus,
    createSubscriptionCheckout,
    cancelPaidSubscription,
    handleWebhook,
  };
}

function stripeId(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id || null;
}

function unixDate(value) {
  return Number.isFinite(value) ? new Date(value * 1000) : null;
}

function mapStripeSubscriptionStatus(status, currentStatus) {
  if (['canceled', 'expired', 'suspended', 'access_revoked'].includes(currentStatus)) {
    return currentStatus;
  }
  if (status === 'active' || status === 'trialing') {
    return currentStatus === 'active' ? 'active' : 'subscription_pending';
  }
  if (status === 'past_due' || status === 'unpaid') return 'past_due';
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled';
  return 'subscription_pending';
}

export default createStripeMarketplaceService;
