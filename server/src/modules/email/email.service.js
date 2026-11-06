/**
 * SyncExc Server — Email service
 *
 * Processes provider webhook events (Resend/Svix) and keeps delivery
 * records in sync with real delivery outcomes.
 *
 * A Resend API acceptance means the request was queued — never that the
 * email reached an inbox. Delivery, bounces, complaints, and failures only
 * become known through webhook events.
 */

const EVENT_TO_DELIVERY_STATUS = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
};

export function createEmailService({ db, queries, logger }) {
  /**
   * Record and process a (signature-verified) webhook event.
   * Returns { duplicate: boolean, status?: string }.
   */
  async function handleWebhookEvent(event) {
    const providerEventId = event?.id;
    const eventType = event?.type;
    const payload = event?.data || {};

    if (!providerEventId || !eventType) {
      throw Object.assign(new Error('Malformed webhook event'), { code: 'WEBHOOK_MALFORMED' });
    }

    const providerMessageId = payload?.email_id || payload?.message_id || null;

    const inserted = await db.tx(async (tx) =>
      queries.insertWebhookEvent(tx, {
        providerEventId,
        provider: 'resend',
        eventType,
        providerMessageId,
        payload: event,
      })
    );

    if (!inserted) {
      logger.debug({ providerEventId, eventType }, 'Duplicate webhook event ignored');
      return { duplicate: true };
    }

    const status = EVENT_TO_DELIVERY_STATUS[eventType];
    if (status && providerMessageId) {
      const fields = { deliveryStatus: status };
      if (status === 'failed') {
        fields.errorCategory = payload?.error_category || 'provider_delivery';
        fields.failureReason = payload?.error_message
          ? String(payload.error_message).slice(0, 500)
          : 'provider reported delivery failure';
      }
      await queries
        .updateDeliveryByMessageId(db, providerMessageId, fields)
        .catch((err) =>
          logger.error({ err, providerMessageId, eventType }, 'Failed to update delivery from webhook')
        );
    }

    if (status === 'bounced' || status === 'complained' || status === 'failed') {
      logger.warn({ providerMessageId, eventType }, `Email ${status}`);
    }

    return { duplicate: false, status: status || null };
  }

  return { handleWebhookEvent };
}

export default createEmailService;
