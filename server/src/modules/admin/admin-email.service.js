/**
 * SyncExc Server — Admin email delivery monitoring
 *
 * Read-only oversight of transactional email delivery. Exposes listing,
 * aggregate stats, recent failures, and webhook event history for the
 * admin communications console. Never exposes tokens or provider secrets.
 */

export function createAdminEmailService({ emailQueries }) {
  async function listDeliveries(query) {
    const filters = {
      emailType: query.emailType,
      requestStatus: query.requestStatus,
      deliveryStatus: query.deliveryStatus,
      provider: query.provider,
      errorCategory: query.errorCategory,
      recipient: query.recipient,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    };
    Object.keys(filters).forEach((k) => filters[k] === undefined && delete filters[k]);

    const limit = Math.min(Number(query.limit) || 50, 200);
    const offset = Number(query.offset) || 0;

    const [items, total] = await Promise.all([
      emailQueries.listDeliveries({ filters, limit, offset }),
      emailQueries.countDeliveries({ filters }),
    ]);

    return { items, total, limit, offset };
  }

  async function deliveryStats({ hours } = {}) {
    const windowHours = Math.min(Math.max(Number(hours) || 24, 1), 24 * 30);
    const [stats, failures, events] = await Promise.all([
      emailQueries.deliveryStats({ hours: windowHours }),
      emailQueries.recentFailures({ limit: 20 }),
      emailQueries.recentWebhookEvents({ limit: 50 }),
    ]);
    return { windowHours, ...stats, recentFailures: failures, recentWebhookEvents: events };
  }

  return { listDeliveries, deliveryStats };
}

export default createAdminEmailService;
