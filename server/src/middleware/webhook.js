/**
 * SyncExc Server — Webhook verification middleware
 *
 * Verifies inbound webhook signatures from payment providers, developer
 * webhooks, and external integrations. Each provider has its own signature
 * scheme; this middleware dispatches by route.
 *
 * Requires `express.json({ verify })` to have captured `req.rawBody`.
 */

import crypto from 'node:crypto';
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

export function verifyStripeSignature({ connectAccount = false } = {}) {
  return async function verifyStripeSignatureMiddleware(req, _res, next) {
    try {
      const secret = connectAccount
        ? config.payouts.stripeConnect.webhookSecret
        : config.payments.stripe.webhookSecret;
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
 * RESEND (Svix signed webhooks)
 *
 * Resend delivers webhook events through Svix. Authenticity is verified
 * against the `svix-id`, `svix-timestamp`, and `svix-signature` headers
 * using the RESEND_WEBHOOK_SECRET (`whsec_...`).
 * ========================================================================== */

function safeCompareBase64(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Exported for unit testing. Verifies a Svix webhook signature.
 */
export function verifySvixSignature({ rawBody, id, timestamp, signature, secret, toleranceSeconds = 300, nowSeconds }) {
  if (!id || !timestamp || !signature || !secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) return false;

  let key;
  try {
    key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  } catch {
    return false;
  }
  if (!key.length) return false;

  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest('base64');

  // svix-signature is a space-delimited list, e.g. "v1,sig1 v1,sig2"
  return signature
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('v1,'))
    .some((part) => safeCompareBase64(part.slice(3), expected));
}

export function verifyResendSignature() {
  return function verifyResendSignatureMiddleware(req, _res, next) {
    const secret = config.email.resendWebhookSecret;
    if (!secret) {
      return next(
        new AuthorizationError('Resend webhook secret not configured', 'WEBHOOK_NOT_CONFIGURED')
      );
    }

    const valid = verifySvixSignature({
      rawBody: req.rawBody || '',
      id: req.headers['svix-id'],
      timestamp: req.headers['svix-timestamp'],
      signature: req.headers['svix-signature'],
      secret,
    });

    if (!valid) {
      logger.warn({ requestId: req.id }, 'Resend webhook signature verification failed');
      return next(new AuthorizationError('Invalid webhook signature', 'WEBHOOK_SIGNATURE_INVALID'));
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
  verifyResendSignature,
  verifyBearerToken,
};