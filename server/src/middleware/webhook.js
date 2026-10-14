/**
 * SyncExc Server — Webhook verification middleware
 *
 * Verifies inbound webhook signatures from payment providers, developer
 * webhooks, and external integrations. Each provider has its own signature
 * scheme; this middleware dispatches by route.
 *
 * Requires `express.json({ verify })` to have captured `req.rawBody`.
 */

import config from '../config.js';
import { AuthorizationError } from '../lib/errors.js';
import { verifyWebhookSignature } from '../lib/crypto.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger({ component: 'webhook' });

/* =============================================================================
 * GENERIC HMAC (X-SyncExc-Signature)
 * ========================================================================== */

/**
 * Verifies a generic SyncExc webhook signature. Used by integrations that
 * sign using our scheme: `X-SyncExc-Signature` + `X-SyncExc-Timestamp`.
 */
export function verifySyncExcSignature({ secret }) {
  return function verifySyncExcSignatureMiddleware(req, _res, next) {
    const signature = req.headers['x-syncexc-signature'];
    const timestamp = req.headers['x-syncexc-timestamp'];

    if (!signature || !timestamp) {
      return next(
        new AuthorizationError('Missing webhook signature headers', 'WEBHOOK_SIGNATURE_MISSING')
      );
    }

    const valid = verifyWebhookSignature({
      payload: req.rawBody || '',
      signature,
      secret,
      timestamp,
      toleranceSeconds: 300,
    });

    if (!valid) {
      logger.warn({ requestId: req.id }, 'Webhook signature verification failed');
      return next(
        new AuthorizationError('Invalid webhook signature', 'WEBHOOK_SIGNATURE_INVALID')
      );
    }

    next();
  };
}

/* =============================================================================
 * STRIPE
 * ========================================================================== */

export function verifyStripeSignature() {
  return async function verifyStripeSignatureMiddleware(req, _res, next) {
    try {
      const secret = config.payments.stripe.webhookSecret;
      if (!secret) {
        return next(
          new AuthorizationError(
            'Stripe webhook secret not configured',
            'WEBHOOK_NOT_CONFIGURED'
          )
        );
      }

      const signature = req.headers['stripe-signature'];
      if (!signature) {
        return next(
          new AuthorizationError('Missing Stripe signature', 'WEBHOOK_SIGNATURE_MISSING')
        );
      }

      // Stripe library required; imported lazily.
      let Stripe;
      try {
        Stripe = (await import('stripe')).default;
      } catch {
        return next(
          new AuthorizationError('Stripe SDK not installed', 'WEBHOOK_SDK_MISSING')
        );
      }

      const stripe = new Stripe(config.payments.stripe.secretKey, {
        apiVersion: '2024-06-20',
      });

      try {
        const event = stripe.webhooks.constructEvent(
          req.rawBody,
          signature,
          secret
        );
        req.webhookEvent = event;
        next();
      } catch (err) {
        logger.warn({ err, requestId: req.id }, 'Stripe signature verification failed');
        next(new AuthorizationError('Invalid Stripe signature', 'WEBHOOK_SIGNATURE_INVALID'));
      }
    } catch (err) {
      next(err);
    }
  };
}

/* =============================================================================
 * PAYSTACK
 * ========================================================================== */

export function verifyPaystackSignature() {
  return function verifyPaystackSignatureMiddleware(req, _res, next) {
    const secret = config.payments.paystack.webhookSecret;
    if (!secret) {
      return next(
        new AuthorizationError('Paystack webhook secret not configured', 'WEBHOOK_NOT_CONFIGURED')
      );
    }

    const signature = req.headers['x-paystack-signature'];
    if (!signature) {
      return next(
        new AuthorizationError('Missing Paystack signature', 'WEBHOOK_SIGNATURE_MISSING')
      );
    }

    // Paystack signs the body with HMAC-SHA512 of the secret.
    const computed = require('node:crypto')
      .createHmac('sha512', secret)
      .update(req.rawBody || '')
      .digest('hex');

    if (computed !== signature) {
      logger.warn({ requestId: req.id }, 'Paystack signature verification failed');
      return next(
        new AuthorizationError('Invalid Paystack signature', 'WEBHOOK_SIGNATURE_INVALID')
      );
    }

    next();
  };
}

/* =============================================================================
 * FLUTTERWAVE
 * ========================================================================== */

export function verifyFlutterwaveSignature() {
  return function verifyFlutterwaveSignatureMiddleware(req, _res, next) {
    const secretHash = config.payments.flutterwave.webhookSecret;
    if (!secretHash) {
      return next(
        new AuthorizationError(
          'Flutterwave webhook secret not configured',
          'WEBHOOK_NOT_CONFIGURED'
        )
      );
    }

    const provided = req.headers['verif-hash'];
    if (!provided) {
      return next(
        new AuthorizationError('Missing Flutterwave signature', 'WEBHOOK_SIGNATURE_MISSING')
      );
    }

    if (provided !== secretHash) {
      logger.warn({ requestId: req.id }, 'Flutterwave signature verification failed');
      return next(
        new AuthorizationError('Invalid Flutterwave signature', 'WEBHOOK_SIGNATURE_INVALID')
      );
    }

    next();
  };
}

/* =============================================================================
 * GENERIC BEARER TOKEN (for simple integrations)
 * ========================================================================== */

export function verifyBearerToken({ secret }) {
  return function verifyBearerTokenMiddleware(req, _res, next) {
    const provided = req.headers['x-webhook-token'];
    if (!provided || provided !== secret) {
      return next(new AuthorizationError('Invalid webhook token', 'WEBHOOK_TOKEN_INVALID'));
    }
    next();
  };
}

export default {
  verifySyncExcSignature,
  verifyStripeSignature,
  verifyPaystackSignature,
  verifyFlutterwaveSignature,
  verifyBearerToken,
};