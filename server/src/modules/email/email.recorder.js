/**
 * SyncExc Server — Email delivery recorder
 *
 * Wraps the transport mailer so that every send produces a durable
 * email_deliveries record:
 *
 *   - row created before sending            (request_status: pending)
 *   - updated with provider message ID      (request_status: accepted)
 *   - updated with failure reason on error  (request_status: failed)
 *   - marked suppressed when no provider    (delivery_status: suppressed)
 *
 * Errors from the underlying transport are re-thrown so callers decide how
 * to handle failure; the record preserves the diagnostic either way.
 * Secrets and raw tokens are never written to the record.
 */

import { createEmailQueries } from './email.queries.js';

export function createEmailDeliveryRecorder({ db, mailer, logger }) {
  const queries = createEmailQueries({ db });

  function safeFailureReason(message) {
    return String(message || 'send failed')
      .replace(/\bre_[A-Za-z0-9_-]+\b/g, '[redacted]')
      .replace(/\bwhsec_[A-Za-z0-9_-]+\b/g, '[redacted]')
      .replace(/([?&]token=)[^&\s]+/gi, '$1[redacted]')
      .slice(0, 500);
  }

  function categorizeError(err) {
    const status = Number(err?.providerStatus ?? err?.statusCode ?? err?.status);
    if (Number.isFinite(status)) {
      if (status === 401) return 'auth';
      if (status === 429) return 'provider_rate_limited';
      if (status === 400 || status === 422) return 'invalid_request';
      if (status >= 500) return 'provider_unavailable';
      if (status >= 400) return 'provider_rejected';
    }
    if (err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT' || err?.code === 'ECONNREFUSED') {
      return 'network';
    }
    if (err?.code === 'EMAIL_SENDER_NOT_CONFIGURED' || err?.code === 'EMAIL_PROVIDER_NOT_CONFIGURED') {
      return 'configuration';
    }
    if (
      err?.code === 'EMAIL_INVALID_RECIPIENT' ||
      err?.code === 'EMAIL_INVALID_SENDER' ||
      err?.code === 'EMAIL_INVALID_SUBJECT' ||
      err?.code === 'VALIDATION_ERROR'
    ) {
      return 'invalid_request';
    }
    if (err?.code === 'EMAIL_PROVIDER_INVALID_RESPONSE') return 'provider_invalid_response';
    return 'unknown';
  }

  return {
    provider: mailer.provider || 'none',

    async send({
      to,
      subject,
      html,
      text,
      attachments,
      from,
      emailType = 'transactional',
      userId = null,
      metadata,
    }) {
      const recipientEmail = Array.isArray(to) ? to[0] : to;
      const provider = mailer.provider || 'unknown';

      let delivery = null;
      try {
        delivery = await queries.insertDelivery(db, {
          userId,
          recipientEmail,
          emailType,
          subject,
          provider,
          requestStatus: 'pending',
          deliveryStatus: 'unknown',
          metadata: { ...(metadata || {}), multiRecipient: Array.isArray(to) && to.length > 1 },
        });
      } catch (err) {
        logger.error({ err, recipientEmail, emailType }, 'Failed to record email request');
      }

      try {
        const result = await mailer.send({ to, subject, html, text, attachments, from });

        if (result?.suppressed) {
          if (delivery) {
            await queries
              .updateDelivery(db, delivery.id, {
                requestStatus: 'skipped',
                deliveryStatus: 'suppressed',
              })
              .catch(() => {});
          }
          return { ...result, deliveryId: delivery?.id || null };
        }

        if (delivery && result?.messageId) {
          await queries
            .updateDelivery(db, delivery.id, {
              requestStatus: 'accepted',
              deliveryStatus: 'queued',
              providerMessageId: result.messageId,
            })
            .catch((err) =>
              logger.error({ err, deliveryId: delivery.id }, 'Failed to update email delivery record')
            );
        }

        return { ...result, deliveryId: delivery?.id || null };
      } catch (err) {
        const category = categorizeError(err);
        const failureReason = safeFailureReason(err?.message);
        // Log full detail server-side; store only a sanitized reason.
        logger.error(
          {
            err: {
              name: err?.name,
              code: err?.code,
              providerErrorCode: err?.providerErrorCode,
              providerStatus: err?.providerStatus,
              message: failureReason,
            },
            recipientEmail,
            emailType,
            category,
          },
          'Email send failed'
        );
        if (delivery) {
          await queries
            .updateDelivery(db, delivery.id, {
              requestStatus: 'failed',
              deliveryStatus: 'failed',
              failureReason,
              errorCategory: category,
            })
            .catch(() => {});
        }
        err.deliveryId = delivery?.id || null;
        err.errorCategory = category;
        err.failureReason = failureReason;
        throw err;
      }
    },

    verify() {
      return mailer.verify();
    },

    close() {
      return mailer.close?.();
    },
  };
}

export default createEmailDeliveryRecorder;
